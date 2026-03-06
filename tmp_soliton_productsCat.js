let sorting = '';
let selectedFilters = [];
const $sortingOptions = $('.sorting .sortingOptions .option');

const sortingOptionsTexts = {
    '9-0' : 'Azalan QiymÉt',
    '0-9' : 'Artan QiymÉt',
    'a-z' : 'Ælifba Ã¼zrÉ: A-Z',
    'z-a' : 'Ælifba Ã¼zrÉ: Z-A',
};

// Pagination state
let currentOffset = 0;
let productsPerPage = 40;
let totalCount = 0;
let loadedCount = 0;
let isLoading = false;

$(function () {
    initsliders();
    initPaginationState();
    urlQueryChanged();

    $('.sorting .sortingBt').on('click', function () {
        $(this).parent('.sorting').toggleClass('active');
    });

    $sortingOptions.on('click', function () {
        sorting = $(this).data('val');

        $('.sorting .sortingBt span.txt').text(sortingOptionsTexts[sorting]);

        setSortingStyle(this);
        changeURL();
        loadProducts(0, productsPerPage, false);
    });

    $('.filtercheckbox INPUT[type="checkbox"]').on("change", function () {
        setSelectedFilters();
        changeURL();
        loadProducts(0, productsPerPage, false);
    });

    $('.selectedFilters').on('click', '.bubble[data-filterid] .remove', function () {
        const filterID = $(this).parents('.bubble').data('filterid');
        const filterValueID = $(this).parents('.bubble').data('filtervalueid');

        if (filterValueID.toString().includes(";")) {
            delete selectedFilters[filterID];
        } else {
            const index = selectedFilters[filterID].indexOf(filterValueID.toString());
            if (index !== -1) {
                selectedFilters[filterID].splice(index, 1);
            }

            if (selectedFilters[filterID].length === 0) {
                delete selectedFilters[filterID];
            }
        }

        changeURL();
        urlQueryChanged();
        loadProducts(0, productsPerPage, false);
    });

    $('.selectedFilters .clearFilters').on('click', function () {
        selectedFilters = [];

        changeURL();
        urlQueryChanged();
        loadProducts(0, productsPerPage, false);
    });

    $('.productCatPage .sortNfilterbt span.filter').on('click', function () {
        $('body').toggleClass('activeFilters');
    });

    $('.productsPage .filtersHolder span.filtersClose').on('click', function () {
        $('body').toggleClass('activeFilters');
    });

    // Load more button handler
    $('#loadMoreProducts').on('click', function () {
        if (!isLoading) {
            loadProducts(loadedCount, productsPerPage, true);
        }
    });
});

function initPaginationState() {
    const $productsList = $('#products-list');
    productsPerPage = parseInt($productsList.data('products-per-page'), 10) || 40;
    totalCount = parseInt($productsList.data('total-count'), 10) || 0;
    loadedCount = parseInt($productsList.data('loaded-count'), 10) || 0;
    currentOffset = loadedCount;
}

function loadProducts(offset, limit, append) {
    if (isLoading) return;

    isLoading = true;
    const $productsList = $('#products-list');
    const $loadMoreBtn = $('#loadMoreProducts');
    const $loadMoreContainer = $('#loadMoreContainer');
    const $noProductsMessage = $('#noProductsMessage');

    // Show loading state
    $loadMoreBtn.find('.label').hide();
    $loadMoreBtn.find('.loader').show();

    // Prepare filter data
    const sectionID = $productsList.data('section-id');
    const brandID = $productsList.data('brand-id');

    // Separate checkbox and slider filters
    const checkboxFilters = {};
    const sliderFilters = {};

    Object.keys(selectedFilters).forEach(function (filterKey) {
        let filterVal = selectedFilters[filterKey];
        if (Array.isArray(filterVal)) {
            // Checkbox filter
            checkboxFilters[filterKey] = filterVal;
        } else {
            // Slider filter
            sliderFilters[filterKey] = filterVal;
        }
    });

    $.ajax({
        url: '/ajax-requests.php',
        type: 'POST',
        dataType: 'json',
        data: {
            action: 'loadProducts',
            sectionID: sectionID,
            brandID: brandID,
            offset: offset,
            limit: limit,
            filters: checkboxFilters,
            sliders: sliderFilters,
            sorting: sorting
        },
        success: function (response) {
            if (append) {
                // Append new products
                $productsList.append(response.html);
            } else {
                // Replace products
                $productsList.html(response.html);
            }

            // Update state
            totalCount = response.totalCount;
            loadedCount = response.loadedCount;
            currentOffset = loadedCount;

            // Update data attributes
            $productsList.data('total-count', totalCount);
            $productsList.data('loaded-count', loadedCount);

            // Update product count in title
            $('#productCount').text('(' + totalCount + ')');

            // Show/hide load more button
            if (response.hasMore) {
                $loadMoreContainer.show();
            } else {
                $loadMoreContainer.hide();
            }

            // Show/hide no products message
            if (totalCount === 0) {
                $noProductsMessage.show();
            } else {
                $noProductsMessage.hide();
            }

            // Update available filters
            if (response.availableFilters) {
                adjustFilters(response.availableFilters);
            }

            // Update tags
            setTags();

            isLoading = false;
            $loadMoreBtn.find('.label').show();
            $loadMoreBtn.find('.loader').hide();
        },
        error: function () {
            isLoading = false;
            $loadMoreBtn.find('.label').show();
            $loadMoreBtn.find('.loader').hide();
        }
    });
}

function setSortingStyle(that) {
    $sortingOptions.removeClass('active');
    if (typeof that === 'string') {
        $sortingOptions.filter('[data-val="' + that + '"]').addClass('active');
    } else {
        $(that).addClass('active');
    }
    $('.sorting').removeClass('active');
}

function changeURL() {
    let urlSearch = "";

    if (sorting !== null && sorting !== '') {
        urlSearch += (urlSearch !== "" ? "&" : "?") + "sorting=" + sorting;
    }

    let filterURLs = [];
    Object.keys(selectedFilters).forEach(function (filterKey) {
        let filterVal = selectedFilters[filterKey];
        if (Array.isArray(filterVal)) {
            // checkbox
            filterURLs.push(filterKey + "=" + filterVal.join("-"));
        } else {
            // slider
            filterURLs.push(filterKey + "=" + filterVal);
        }
    });

    let filterURL = filterURLs.join("&");
    if (filterURL !== "") {
        urlSearch += (urlSearch !== "" ? "&" : "?") + filterURL;
    }

    if (urlSearch === "") {
        urlSearch = "?";
    }

    window.history.pushState("History changed", urlSearch, urlSearch);
}

function urlQueryChanged() {
    let searchParams = getSearchParams();

    selectedFilters = [];

    $('.filterslider INPUT[type="slider"]').each(function () {
        $(this).data("ionRangeSlider").reset();
    });

    $('.filtercheckbox INPUT[type="checkbox"]').prop("checked", false);

    Object.keys(searchParams).forEach(function (queryParam) {
        if (queryParam.startsWith("filter")) {
            let filterVal = searchParams[queryParam];

            if (filterVal.includes(";")) {
                selectedFilters[queryParam] = searchParams[queryParam];
                setFilter(queryParam, searchParams[queryParam]);
            } else {
                selectedFilters[queryParam] = searchParams[queryParam].split("-");
                setFilter(queryParam, searchParams[queryParam].split("-"));
            }
        }
    });

    if (searchParams["sorting"] !== undefined && searchParams["sorting"] !== "") {
        $("#sorting").val(searchParams["sorting"]);
        sorting = searchParams["sorting"];

        setSortingStyle(sorting);
    } else {
        $("#sorting").val("");
        sorting = "";

        setSortingStyle(sorting);
    }
}

function setFilter(filterName, filterValues) {
    if (Array.isArray(filterValues)) {
        // checkbox
        $('.filtercheckbox INPUT[name="' + filterName + '"]').each(function () {
            if (filterValues.indexOf($(this).val()) > -1) {
                $(this).prop("checked", true);
            }
        });
    } else {
        let fromTo = filterValues.split(";");

        $('.filterslider INPUT[name="' + filterName + '"]')
            .data("ionRangeSlider")
            .update({
                from: fromTo[0],
                to: fromTo[1],
            });
    }
}

function adjustFilters(availableFilters) {
    // availableFilters = array of fvid from server response
    $('.filters .filtercheckbox INPUT[type="checkbox"]').each(function () {
        let filterVal = parseInt($(this).val(), 10);
        if (availableFilters.indexOf(filterVal) === -1) {
            $(this).parents('.filtercheckbox').addClass('notactive');
            $(this).addClass("disabled").attr("disabled", true);
        } else {
            $(this).parents('.filtercheckbox').removeClass('notactive');
            $(this).removeClass("disabled").attr("disabled", false);
        }
    });
}

function setSelectedFilters() {
    selectedFilters = [];

    $('.filtercheckbox INPUT[type="checkbox"]').each(function () {
        let filterValueId = $(this).val();

        if ($(this).is(":checked")) {
            if (!Array.isArray(selectedFilters[$(this).attr("name")])) {
                selectedFilters[$(this).attr("name")] = [];
            }

            selectedFilters[$(this).attr("name")].pushUnique(filterValueId);
        } else {
            if (selectedFilters[$(this).attr("name")] !== undefined) {
                const index = selectedFilters[$(this).attr("name")].indexOf(filterValueId);
                if (index !== -1) {
                    selectedFilters[$(this).attr("name")].splice(index, 1);
                }
            }
        }
    });

    $('.filterslider INPUT[type="slider"]').each(function () {
        let sliderVal = $(this).val(); // 16;128
        let sliderName = $(this).prop("name");

        let sliderValues = sliderVal.split(";");

        if (!(sliderValues[0] === this.dataset.from && sliderValues[1] === this.dataset.to)) {
            selectedFilters[sliderName] = sliderVal;
        }
    });
}

function setTags() {
    let tags = '';

    $selectedFiltersFlkty.remove($('.bubble[data-filterid]'));

    Object.entries(selectedFilters).forEach(([key, value]) => {
        const filterTitleEl = document.getElementById('title' + key);
        if (!filterTitleEl) return;

        const filterTitle = filterTitleEl.dataset.title;

        let valueTitle = '';
        if (typeof value === 'string' && value.includes(';')) {
            valueTitle = value.replace(";", "-");

            const bubble = `<div class="bubble" data-filterid="${key}" data-filtervalueid="${value}">
                                <span class="selectedFilter">
                                    <span class="label">${filterTitle}: ${valueTitle}</span>
                                    <span class="icon remove"></span>
                                </span>
                            </div>`;
            tags += bubble;
        } else if (Array.isArray(value) && value.length > 0) {

            for (let i = 0; i < value.length; i++) {
                const valueTitleEl = document.getElementById('valuetitlefilter' + value[i]);
                if (!valueTitleEl) continue;

                valueTitle = valueTitleEl.dataset.title;

                const bubble = `<div class="bubble" data-filterid="${key}" data-filtervalueid="${value[i]}">
                                    <span class="selectedFilter">
                                        <span class="label">${filterTitle}: ${valueTitle}</span>
                                        <span class="icon remove"></span>
                                    </span>
                                </div>`;
                tags += bubble;
            }
        }
    });

    const $cellElems = $(tags);

    if (tags !== '') {
        document.querySelector('.selectedFilters').classList.add('active');
    } else if ($('.bubble[data-brand]').length === 0) {
        document.querySelector('.selectedFilters').classList.remove('active');
    }

    $selectedFiltersFlkty.append($cellElems);
    $selectedFiltersFlkty.resize();
}

function initsliders() {
    let $sliders = $('.filterslider INPUT[type="slider"]');

    if ($sliders.length) {
        $sliders.ionRangeSlider({
            skin: "round",
            type: "double",
            grid: false,
            onStart: updateInputs,
            onChange: updateInputs,
            onUpdate: updateInputs,
            onFinish: function () {
                setSelectedFilters();
                changeURL();
                loadProducts(0, productsPerPage, false);
            },
        });

        function updateInputs(data) {
            const sliderID = data.input[0].id;
            const from = data.from;
            const to = data.to;

            $('#' + sliderID + 'From').prop("value", from);
            $('#' + sliderID + 'To').prop("value", to);
        }

        $('.filtersliderInputsFrom').on("input", function () {
            const inputID = $(this).attr('id').slice(0, -4);
            const instance = $('#' + inputID).data("ionRangeSlider");

            let val = $(this).prop("value");

            const to = instance.options.to;
            const min = instance.options.min;

            // validate
            if (val < min) {
                val = min;
            } else if (val > to) {
                val = to;
            }

            instance.update({
                from: val
            });
        });

        $('.filtersliderInputsTo').on("input", function () {
            const inputID = $(this).attr('id').slice(0, -2);
            const instance = $('#' + inputID).data("ionRangeSlider");

            const from = instance.options.from;
            const max = instance.options.max;

            let val = $(this).prop("value");

            if (val < from) {
                val = from;
            } else if (val > max) {
                val = max;
            }

            instance.update({
                to: val
            });
        });
    }
}

window.onpopstate = function () {
    urlQueryChanged();
    loadProducts(0, productsPerPage, false);
};

const $selectedFiltersFlkty = new Flickity(document.querySelector('.selectedFilters'), {
    cellSelector: 'div.bubble',
    cellAlign: 'left',
    contain: true,
    wrapAround: false,
    pageDots: false,
    prevNextButtons: false,
    // watchCSS: true,
});

$(function () {
    $('.colors SPAN').on('click', function () {
        let $parent = $(this).parent();

        $parent.find('SPAN').removeClass('selected');
        $(this).addClass('selected');

        let picture = $(this).data('picture');
        let url = $(this).data('url');

        $(this).closest('.product-item').find('a.title').attr('href', url);
        $(this).closest('.product-item').find('a.thumbHolder').attr('href', url);

        $parent.siblings('.thumbHolder').find('IMG').attr('src', picture);
    });
});

