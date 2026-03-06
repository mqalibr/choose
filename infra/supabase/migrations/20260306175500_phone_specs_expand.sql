-- Expand phone_specs into a complete typed spec model for production filters.

create table if not exists public.phone_specs (
  product_id bigint primary key references public.products(id) on delete cascade,
  battery_mah integer check (battery_mah is null or battery_mah > 0),
  has_nfc boolean,
  ram_gb smallint check (ram_gb is null or ram_gb > 0),
  storage_gb integer check (storage_gb is null or storage_gb > 0),
  chipset text,
  os_name text,
  sim_count smallint check (sim_count is null or sim_count between 1 and 4),
  main_camera_mp numeric(5,1) check (main_camera_mp is null or main_camera_mp > 0),
  has_wireless_charge boolean,
  screen_size_in numeric(4,2) check (screen_size_in is null or screen_size_in > 0),
  raw_specs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_phone_specs_updated_at on public.phone_specs;
create trigger trg_phone_specs_updated_at
before update on public.phone_specs
for each row execute function public.set_updated_at();

alter table public.phone_specs
  add column if not exists chipset_vendor text,
  add column if not exists chipset_model text,
  add column if not exists cpu_cores smallint check (cpu_cores is null or cpu_cores between 1 and 24),
  add column if not exists gpu_model text,
  add column if not exists os_version text,
  add column if not exists has_esim boolean,
  add column if not exists has_5g boolean,
  add column if not exists has_wifi_6 boolean,
  add column if not exists bluetooth_version text,
  add column if not exists ultrawide_camera_mp numeric(5,1) check (ultrawide_camera_mp is null or ultrawide_camera_mp > 0),
  add column if not exists telephoto_camera_mp numeric(5,1) check (telephoto_camera_mp is null or telephoto_camera_mp > 0),
  add column if not exists selfie_camera_mp numeric(5,1) check (selfie_camera_mp is null or selfie_camera_mp > 0),
  add column if not exists has_ois boolean,
  add column if not exists wired_charge_w numeric(6,2) check (wired_charge_w is null or wired_charge_w > 0),
  add column if not exists wireless_charge_w numeric(6,2) check (wireless_charge_w is null or wireless_charge_w > 0),
  add column if not exists refresh_rate_hz smallint check (refresh_rate_hz is null or refresh_rate_hz between 30 and 240),
  add column if not exists panel_type text,
  add column if not exists resolution_width integer check (resolution_width is null or resolution_width > 0),
  add column if not exists resolution_height integer check (resolution_height is null or resolution_height > 0),
  add column if not exists weight_g numeric(6,2) check (weight_g is null or weight_g > 0),
  add column if not exists ip_rating text,
  add column if not exists release_year smallint check (release_year is null or release_year between 2000 and 2100),
  add column if not exists specs_confidence numeric(4,3) not null default 0.500 check (specs_confidence >= 0 and specs_confidence <= 1),
  add column if not exists last_parsed_at timestamptz;

create index if not exists phone_specs_chipset_vendor_idx on public.phone_specs (chipset_vendor);
create index if not exists phone_specs_cpu_cores_idx on public.phone_specs (cpu_cores);
create index if not exists phone_specs_gpu_model_idx on public.phone_specs (gpu_model);
create index if not exists phone_specs_os_version_idx on public.phone_specs (os_version);
create index if not exists phone_specs_has_5g_idx on public.phone_specs (has_5g);
create index if not exists phone_specs_has_esim_idx on public.phone_specs (has_esim);
create index if not exists phone_specs_sim_count_idx on public.phone_specs (sim_count);
create index if not exists phone_specs_refresh_rate_idx on public.phone_specs (refresh_rate_hz);
create index if not exists phone_specs_panel_type_idx on public.phone_specs (panel_type);
create index if not exists phone_specs_release_year_idx on public.phone_specs (release_year);
create index if not exists phone_specs_main_camera_idx on public.phone_specs (main_camera_mp);
create index if not exists phone_specs_selfie_camera_idx on public.phone_specs (selfie_camera_mp);
create index if not exists phone_specs_weight_idx on public.phone_specs (weight_g);
create index if not exists phone_specs_os_name_lower_idx on public.phone_specs (lower(os_name));
create index if not exists phone_specs_chipset_model_trgm_idx
  on public.phone_specs using gin (chipset_model gin_trgm_ops);
create index if not exists phone_specs_raw_specs_gin_idx
  on public.phone_specs using gin (raw_specs jsonb_path_ops);
