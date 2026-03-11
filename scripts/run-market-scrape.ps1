param(
  [ValidateSet("all", "phones", "tablets", "tvs")]
  [string]$Mode = "all",
  [string]$Stores = "kontakt-home,irshad,soliton,baku-electronics",
  [int]$MaxItemsPerStore = 80,
  [int]$MaxConcurrency = 2,
  [switch]$DryRun,
  [switch]$PreflightOnly
)

$ErrorActionPreference = "Stop"

$StoreCatalog = @(
  [pscustomobject]@{ slug = "kontakt-home"; name = "Kontakt Home"; url = "https://kontakt.az/"; implemented = $true; specs = "Telefon/Planset typed+raw, TV raw" },
  [pscustomobject]@{ slug = "irshad"; name = "Irshad"; url = "https://irshad.az/"; implemented = $true; specs = "Telefon/Planset typed+raw, TV raw" },
  [pscustomobject]@{ slug = "baku-electronics"; name = "Baku Electronics"; url = "https://www.bakuelectronics.az/"; implemented = $true; specs = "Telefon/Planset/TV raw + telefon typed" },
  [pscustomobject]@{ slug = "soliton"; name = "Soliton"; url = "https://soliton.az/"; implemented = $true; specs = "Telefon/Planset/TV raw + telefon typed" },
  [pscustomobject]@{ slug = "smartelectronics"; name = "Smart Electronics"; url = "https://smartelectronics.az/"; implemented = $true; specs = "Skeleton parser + generic detail spec parse" },
  [pscustomobject]@{ slug = "birmarket"; name = "BirMarket"; url = "https://birmarket.az/"; implemented = $true; specs = "Skeleton parser + generic detail spec parse" },
  [pscustomobject]@{ slug = "megamart"; name = "MegaMart"; url = "https://megamart.az/"; implemented = $true; specs = "Skeleton parser + generic detail spec parse" },
  [pscustomobject]@{ slug = "barkod-electronics"; name = "Barkod Electronics"; url = "https://www.barkodelectronics.az/"; implemented = $true; specs = "Skeleton parser + generic detail spec parse" },
  [pscustomobject]@{ slug = "elit-optimal"; name = "Elit Optimal"; url = "https://elitoptimal.az/"; implemented = $true; specs = "Skeleton parser + generic detail spec parse" },
  [pscustomobject]@{ slug = "w-t"; name = "W-T"; url = "https://www.w-t.az/"; implemented = $true; specs = "Skeleton parser + generic detail spec parse" },
  [pscustomobject]@{ slug = "smarton"; name = "SmartOn"; url = "https://smarton.az/"; implemented = $true; specs = "Skeleton parser + generic detail spec parse" },
  [pscustomobject]@{ slug = "bakcell-shop"; name = "Bakcell Shop"; url = "https://shop.bakcell.com/"; implemented = $true; specs = "Skeleton parser + generic detail spec parse" },
  [pscustomobject]@{ slug = "bytelecom"; name = "ByTelecom"; url = "https://bytelecom.az/"; implemented = $true; specs = "Skeleton parser + generic detail spec parse" }
)

function Write-Section([string]$text) {
  Write-Host ""
  Write-Host "==== $text ====" -ForegroundColor Cyan
}

function Normalize-SlugList([string]$raw) {
  return $raw.Split(",") | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ -ne "" } | Select-Object -Unique
}

function Test-DbStoreRegistry {
  if ([string]::IsNullOrWhiteSpace($env:NEXT_PUBLIC_SUPABASE_URL) -or [string]::IsNullOrWhiteSpace($env:SUPABASE_SERVICE_ROLE_KEY)) {
    Write-Host "DB yoxlamasi skip edildi: NEXT_PUBLIC_SUPABASE_URL ve ya SUPABASE_SERVICE_ROLE_KEY yoxdur." -ForegroundColor Yellow
    return
  }

  try {
    $headers = @{
      "apikey"        = $env:SUPABASE_SERVICE_ROLE_KEY
      "Authorization" = "Bearer $($env:SUPABASE_SERVICE_ROLE_KEY)"
    }
    $uri = "$($env:NEXT_PUBLIC_SUPABASE_URL.TrimEnd('/'))/rest/v1/stores?select=slug&limit=1000"
    $rows = Invoke-RestMethod -Method GET -Uri $uri -Headers $headers
    $dbSlugs = @($rows | ForEach-Object { $_.slug })
    $missing = $StoreCatalog | Where-Object { $dbSlugs -notcontains $_.slug }

    if ($missing.Count -eq 0) {
      Write-Host "DB stores cedveli: butun hedef slug-lar movcuddur." -ForegroundColor Green
    } else {
      Write-Host "DB stores cedvelinde olmayan slug-lar:" -ForegroundColor Yellow
      $missing | ForEach-Object { Write-Host " - $($_.slug) ($($_.name))" -ForegroundColor Yellow }
    }
  } catch {
    Write-Host "DB store registry yoxlamasi alinmadi: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

function Show-Preflight([string[]]$requestedSlugs) {
  Write-Section "Preflight"
  $requestedCatalog = @($StoreCatalog | Where-Object { $requestedSlugs -contains $_.slug })
  $implementedRequested = @($requestedCatalog | Where-Object { $_.implemented -eq $true })
  $missingRequested = @($requestedCatalog | Where-Object { $_.implemented -eq $false })

  Write-Host "Secilen store parserleri:"
  if ($implementedRequested.Count -gt 0) {
    $implementedRequested | ForEach-Object { Write-Host " - $($_.slug) => $($_.specs)" -ForegroundColor Green }
  } else {
    Write-Host " - (yoxdur)" -ForegroundColor Yellow
  }

  Write-Host ""
  if ($missingRequested.Count -gt 0) {
    Write-Host "Secilenlerden hazir olmayan (skeleton lazimdir):"
    $missingRequested | ForEach-Object { Write-Host " - $($_.slug) ($($_.url))" -ForegroundColor Yellow }
  } else {
    Write-Host "Secilen store-larin hamisi implement olunub." -ForegroundColor Green
  }

  Write-Host ""
  $unknown = $requestedSlugs | Where-Object { $StoreCatalog.slug -notcontains $_ }
  if ($unknown.Count -gt 0) {
    Write-Host "Namelum slug-lar: $($unknown -join ', ')" -ForegroundColor Yellow
  }

  Test-DbStoreRegistry
}

function Set-CommonEnv([string]$storesCsv) {
  $env:SCRAPER_ONLY_STORES = $storesCsv
  $env:SCRAPER_MAX_CONCURRENCY = [string]$MaxConcurrency
  $env:SCRAPER_MAX_ITEMS = [string]$MaxItemsPerStore
  $env:SCRAPER_DRY_RUN = if ($DryRun) { "true" } else { "false" }

  $env:KONTAKT_FETCH_DETAIL_SPECS = "true"
  $env:KONTAKT_MAX_DETAIL_ITEMS = [string]$MaxItemsPerStore
  $env:IRSHAD_FETCH_DETAIL_SPECS = "true"
  $env:IRSHAD_MAX_DETAIL_ITEMS = [string]$MaxItemsPerStore
  $env:SOLITON_FETCH_DETAIL_SPECS = "true"
  $env:SOLITON_MAX_DETAIL_ITEMS = [string]$MaxItemsPerStore
  $env:BAKU_FETCH_DETAIL_SPECS = "true"
  $env:BAKU_MAX_DETAIL_ITEMS = [string]$MaxItemsPerStore

  $env:SMARTELECTRONICS_FETCH_DETAIL_SPECS = "true"
  $env:SMARTELECTRONICS_MAX_DETAIL_ITEMS = [string]$MaxItemsPerStore
  $env:BIRMARKET_FETCH_DETAIL_SPECS = "true"
  $env:BIRMARKET_MAX_DETAIL_ITEMS = [string]$MaxItemsPerStore
  $env:MEGAMART_FETCH_DETAIL_SPECS = "true"
  $env:MEGAMART_MAX_DETAIL_ITEMS = [string]$MaxItemsPerStore
  $env:BARKOD_FETCH_DETAIL_SPECS = "true"
  $env:BARKOD_MAX_DETAIL_ITEMS = [string]$MaxItemsPerStore
  $env:ELIT_OPTIMAL_FETCH_DETAIL_SPECS = "true"
  $env:ELIT_OPTIMAL_MAX_DETAIL_ITEMS = [string]$MaxItemsPerStore
  $env:WT_FETCH_DETAIL_SPECS = "true"
  $env:WT_MAX_DETAIL_ITEMS = [string]$MaxItemsPerStore
  $env:SMARTON_FETCH_DETAIL_SPECS = "true"
  $env:SMARTON_MAX_DETAIL_ITEMS = [string]$MaxItemsPerStore
  $env:BAKCELL_SHOP_FETCH_DETAIL_SPECS = "true"
  $env:BAKCELL_SHOP_MAX_DETAIL_ITEMS = [string]$MaxItemsPerStore
  $env:BYTELECOM_FETCH_DETAIL_SPECS = "true"
  $env:BYTELECOM_MAX_DETAIL_ITEMS = [string]$MaxItemsPerStore
}

function Set-CategoryEnv([string]$category) {
  Remove-Item Env:BAKU_CATEGORY_SLUGS -ErrorAction SilentlyContinue
  Remove-Item Env:SOLITON_CATEGORY_URLS -ErrorAction SilentlyContinue

  switch ($category) {
    "phones" {
      $env:KONTAKT_CATEGORY_URLS = "https://kontakt.az/telefoniya/smartfonlar"
      $env:IRSHAD_CATEGORY_URLS = "https://irshad.az/az/telefon-ve-aksesuarlar/mobil-telefonlar"
      $env:SOLITON_CATEGORY_URLS = "https://soliton.az/az/telefon/mobil-telefonlar/"
      $env:BAKU_CATEGORY_SLUG = "telefonlar"
      $env:BAKU_SEARCH_TERMS = "telefon,smartfon,iphone,samsung,xiaomi,redmi,poco,honor,oppo,realme,vivo,infinix,tecno,nokia,motorola"

      $env:SMARTELECTRONICS_CATEGORY_URLS = "https://smartelectronics.az/az/smartfon-ve-aksesuarlar"
      $env:BIRMARKET_CATEGORY_URLS = "https://birmarket.az/telefonlar"
      $env:MEGAMART_CATEGORY_URLS = "https://megamart.az/telefonlar"
      $env:BARKOD_CATEGORY_URLS = "https://www.barkodelectronics.az/telefonlar"
      $env:ELIT_OPTIMAL_CATEGORY_URLS = "https://elitoptimal.az/telefonlar"
      $env:WT_CATEGORY_URLS = "https://www.w-t.az/telefonlar"
      $env:SMARTON_CATEGORY_URLS = "https://smarton.az/telefonlar"
      $env:BAKCELL_SHOP_CATEGORY_URLS = "https://shop.bakcell.com/telefonlar"
      $env:BYTELECOM_CATEGORY_URLS = "https://bytelecom.az/telefonlar"
    }
    "tablets" {
      $env:KONTAKT_CATEGORY_URLS = "https://kontakt.az/plansetler-ve-elektron-kitablar/plansetler"
      $env:IRSHAD_CATEGORY_URLS = "https://irshad.az/az/notbuk-planset-ve-komputer-texnikasi/plansetler"
      $env:SOLITON_CATEGORY_URLS = "https://soliton.az/az/komputer-ve-aksesuarlar/plansetler/"
      $env:BAKU_CATEGORY_SLUG = "plansetler"
      $env:BAKU_SEARCH_TERMS = "planset,tablet,ipad,galaxy tab,xiaomi pad,redmi pad,honor pad,lenovo tab,matepad"

      $env:SMARTELECTRONICS_CATEGORY_URLS = "https://smartelectronics.az/az/smartfon-ve-aksesuarlar/plansetler"
      $env:BIRMARKET_CATEGORY_URLS = "https://birmarket.az/plansetler"
      $env:MEGAMART_CATEGORY_URLS = "https://megamart.az/plansetler"
      $env:BARKOD_CATEGORY_URLS = "https://www.barkodelectronics.az/plansetler"
      $env:ELIT_OPTIMAL_CATEGORY_URLS = "https://elitoptimal.az/plansetler"
      $env:WT_CATEGORY_URLS = "https://www.w-t.az/plansetler"
      $env:SMARTON_CATEGORY_URLS = "https://smarton.az/plansetler"
      $env:BAKCELL_SHOP_CATEGORY_URLS = "https://shop.bakcell.com/plansetler"
      $env:BYTELECOM_CATEGORY_URLS = "https://bytelecom.az/plansetler"
    }
    "tvs" {
      $env:KONTAKT_CATEGORY_URLS = "https://kontakt.az/tv-audio-ve-video/televizorlar"
      $env:IRSHAD_CATEGORY_URLS = "https://irshad.az/az/tv-ve-audio/televizorlar"
      $env:SOLITON_CATEGORY_URLS = "https://soliton.az/az/tv-ve-audio/televizorlar/"
      $env:BAKU_CATEGORY_SLUG = "televizorlar"
      $env:BAKU_SEARCH_TERMS = "televizor,tv,smart tv,oled tv,qled tv,uhd tv,android tv"

      $env:SMARTELECTRONICS_CATEGORY_URLS = "https://smartelectronics.az/az/tv--audio--foto-texnika/televizorlar"
      $env:BIRMARKET_CATEGORY_URLS = "https://birmarket.az/televizorlar"
      $env:MEGAMART_CATEGORY_URLS = "https://megamart.az/televizorlar"
      $env:BARKOD_CATEGORY_URLS = "https://www.barkodelectronics.az/televizorlar"
      $env:ELIT_OPTIMAL_CATEGORY_URLS = "https://elitoptimal.az/televizorlar"
      $env:WT_CATEGORY_URLS = "https://www.w-t.az/televizorlar"
      $env:SMARTON_CATEGORY_URLS = "https://smarton.az/televizorlar"
      $env:BAKCELL_SHOP_CATEGORY_URLS = "https://shop.bakcell.com/televizorlar"
      $env:BYTELECOM_CATEGORY_URLS = "https://bytelecom.az/televizorlar"
    }
    default {
      throw "Desteklenmeyen kateqoriya: $category"
    }
  }
}

function Set-AllCategoryEnv {
  $env:KONTAKT_CATEGORY_URLS = "https://kontakt.az/telefoniya/smartfonlar,https://kontakt.az/plansetler-ve-elektron-kitablar/plansetler,https://kontakt.az/tv-audio-ve-video/televizorlar"
  $env:IRSHAD_CATEGORY_URLS = "https://irshad.az/az/telefon-ve-aksesuarlar/mobil-telefonlar,https://irshad.az/az/notbuk-planset-ve-komputer-texnikasi/plansetler,https://irshad.az/az/tv-ve-audio/televizorlar"
  $env:SOLITON_CATEGORY_URLS = "https://soliton.az/az/telefon/mobil-telefonlar/,https://soliton.az/az/komputer-ve-aksesuarlar/plansetler/,https://soliton.az/az/tv-ve-audio/televizorlar/"

  $env:SMARTELECTRONICS_CATEGORY_URLS = "https://smartelectronics.az/az/smartfon-ve-aksesuarlar,https://smartelectronics.az/az/smartfon-ve-aksesuarlar/plansetler,https://smartelectronics.az/az/tv--audio--foto-texnika/televizorlar"
  $env:BIRMARKET_CATEGORY_URLS = "https://birmarket.az/telefonlar,https://birmarket.az/plansetler,https://birmarket.az/televizorlar"
  $env:MEGAMART_CATEGORY_URLS = "https://megamart.az/telefonlar,https://megamart.az/plansetler,https://megamart.az/televizorlar"
  $env:BARKOD_CATEGORY_URLS = "https://www.barkodelectronics.az/telefonlar,https://www.barkodelectronics.az/plansetler,https://www.barkodelectronics.az/televizorlar"
  $env:ELIT_OPTIMAL_CATEGORY_URLS = "https://elitoptimal.az/telefonlar,https://elitoptimal.az/plansetler,https://elitoptimal.az/televizorlar"
  $env:WT_CATEGORY_URLS = "https://www.w-t.az/telefonlar,https://www.w-t.az/plansetler,https://www.w-t.az/televizorlar"
  $env:SMARTON_CATEGORY_URLS = "https://smarton.az/telefonlar,https://smarton.az/plansetler,https://smarton.az/televizorlar"
  $env:BAKCELL_SHOP_CATEGORY_URLS = "https://shop.bakcell.com/telefonlar,https://shop.bakcell.com/plansetler,https://shop.bakcell.com/televizorlar"
  $env:BYTELECOM_CATEGORY_URLS = "https://bytelecom.az/telefonlar,https://bytelecom.az/plansetler,https://bytelecom.az/televizorlar"

  $env:BAKU_CATEGORY_SLUGS = "telefonlar,plansetler,televizorlar"
  Remove-Item Env:BAKU_CATEGORY_SLUG -ErrorAction SilentlyContinue
  Remove-Item Env:BAKU_SEARCH_TERMS -ErrorAction SilentlyContinue
  Remove-Item Env:SOLITON_CATEGORY_URL -ErrorAction SilentlyContinue
}

function Invoke-ScrapeForCategory([string]$category, [string]$storesCsv) {
  Write-Section "Scrape: $category"
  Set-CommonEnv -storesCsv $storesCsv
  Set-CategoryEnv -category $category

  Write-Host "SCRAPER_ONLY_STORES=$storesCsv"
  Write-Host "SCRAPER_MAX_ITEMS=$($env:SCRAPER_MAX_ITEMS)"
  Write-Host "SCRAPER_MAX_CONCURRENCY=$($env:SCRAPER_MAX_CONCURRENCY)"
  Write-Host "SCRAPER_DRY_RUN=$($env:SCRAPER_DRY_RUN)"
  Write-Host "BAKU_CATEGORY_SLUG=$($env:BAKU_CATEGORY_SLUG)"

  npm run scrape
  if ($LASTEXITCODE -ne 0) {
    throw "Scrape ugursuz oldu: $category"
  }
}

function Invoke-ScrapeAllInOne([string]$storesCsv) {
  Write-Section "Scrape: all-in-one"
  Set-CommonEnv -storesCsv $storesCsv
  Set-AllCategoryEnv
  $env:SCRAPER_MAX_ITEMS = [string]($MaxItemsPerStore * 3)

  Write-Host "SCRAPER_ONLY_STORES=$storesCsv"
  Write-Host "SCRAPER_MAX_ITEMS=$($env:SCRAPER_MAX_ITEMS)"
  Write-Host "SCRAPER_MAX_CONCURRENCY=$($env:SCRAPER_MAX_CONCURRENCY)"
  Write-Host "SCRAPER_DRY_RUN=$($env:SCRAPER_DRY_RUN)"
  Write-Host "BAKU_CATEGORY_SLUGS=$($env:BAKU_CATEGORY_SLUGS)"

  npm run scrape
  if ($LASTEXITCODE -ne 0) {
    throw "Scrape ugursuz oldu: all-in-one"
  }
}

$requestedSlugs = Normalize-SlugList -raw $Stores
Show-Preflight -requestedSlugs $requestedSlugs

$implementedRequested = @($requestedSlugs | Where-Object {
  $slug = $_
  @($StoreCatalog | Where-Object { $_.slug -eq $slug -and $_.implemented -eq $true }).Count -gt 0
})
$skipped = @($requestedSlugs | Where-Object { $implementedRequested -notcontains $_ })

if ($skipped.Count -gt 0) {
  Write-Host ""
  Write-Host "Bu slug-lar hele implement olunmayib, ona gore skip edilecek:" -ForegroundColor Yellow
  $skipped | ForEach-Object { Write-Host " - $_" -ForegroundColor Yellow }
}

if ($implementedRequested.Count -eq 0) {
  throw "Hec bir implement olunmus store secilmeyib."
}

if ($PreflightOnly) {
  Write-Host ""
  Write-Host "PreflightOnly=true oldugu ucun scrape baslamadi." -ForegroundColor Cyan
  exit 0
}

$storesCsv = ($implementedRequested -join ",")
switch ($Mode) {
  "all" {
    Invoke-ScrapeAllInOne -storesCsv $storesCsv
  }
  "phones" { Invoke-ScrapeForCategory -category "phones" -storesCsv $storesCsv }
  "tablets" { Invoke-ScrapeForCategory -category "tablets" -storesCsv $storesCsv }
  "tvs" { Invoke-ScrapeForCategory -category "tvs" -storesCsv $storesCsv }
}

Write-Section "Bitdi"
Write-Host "Scrape run tamamlandi." -ForegroundColor Green
