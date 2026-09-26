/* =========================================================
   SOCHACZEW ODPADY
   ZOPTYMALIZOWANY app.js
   ========================================================= */


/* =========================================================
   KOLORY I NAZWY ODPADÓW
   ZMIENIASZ KOLORY TYLKO TUTAJ
   ========================================================= */

const WASTE_TYPES = {
    yellow: {
        name: "Tworzywa sztuczne i metale",
        bag: "worek żółty",
        color: "#F4C542"
    },

    blue: {
        name: "Papier",
        bag: "worek niebieski",
        color: "#3B82F6"
    },

    brown: {
        name: "Bioodpady",
        bag: "worek brązowy",
        color: "#9A6B3F"
    },

    green: {
        name: "Szkło",
        bag: "worek zielony",
        color: "#22A447"
    },

    gray: {
        name: "Popiół",
        bag: "worek szary",
        color: "#9CA3AF"
    },

    mixed: {
        name: "Odpady zmieszane",
        bag: null,
        color: "#222222"
    },

    white: {
        name: "Tekstylia",
        bag: "worek biały",
        color: "#FFFFFF"
    },

    purple: {
        name: "Gabaryty",
        bag: null,
        color: "#8B5CF6"
    }
};


/* =========================================================
   GŁÓWNE ZMIENNE
   ========================================================= */

let schedule = null;

let selectedStreet =
    localStorage.getItem("selectedStreet") || "";

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

let pendingFavoriteStreet = "";


/* =========================================================
   CACHE
   Najważniejsza część optymalizacji telefonu.
   ========================================================= */

let streetListCache = null;

let normalizedStreetListCache = null;

const streetLookupCache = new Map();

const streetZonesCache = new Map();

const streetScheduleCache = new Map();

const calendarDateCache = new Map();


/* =========================================================
   ALIASY ULIC
   ========================================================= */

const STREET_ALIASES = {

    "korczaka": [
        "korczak"
    ],

    "korczak": [
        "korczaka"
    ],

    "krzywoustego": [
        "bolesława krzywoustego"
    ],

    "11 listopada": [
        "11-go listopada"
    ],

    "brzechwy": [
        "jana brzechwy"
    ],

    "chrobrego": [
        "bolesława chrobrego"
    ],

    "popiełuszki": [
        "księdza j. popiełuszki"
    ],

    "stwosza": [
        "wita stwosza"
    ],

    "tuwima": [
        "juliana tuwima"
    ],

    "twardowskiego": [
        "księdza jana twardowskiego"
    ],

    "śmiałego": [
        "bolesława śmiałego"
    ],

    "ks. ziemowita": [
        "ziemowita"
    ],

    "skłodowskiej-curie": [
        "skłodowskiej"
    ],

    "jana iii sobieskiego": [
        "sobieskiego"
    ]
};


/* =========================================================
   NORMALIZACJA ULIC
   ========================================================= */

function normalizeStreet(value) {

    return String(value || "")
        .toLocaleLowerCase("pl-PL")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ł/g, "l")
        .replace(/\([^)]*\)/g, "")
        .replace(/\bul\.?\s*/g, "")
        .replace(/\bulica\s*/g, "")
        .replace(/\s+/g, " ")
        .replace(/[.,]/g, "")
        .trim();

}


/* =========================================================
   USUWANIE NUMERU DOMU
   ========================================================= */

function removeHouseNumber(value) {

    return String(value || "")
        .replace(
            /\s+(?:m\.?\s*)?\d+[a-zA-Z]?\s*$/u,
            ""
        )
        .trim();

}


/* =========================================================
   ALIAS KEYS
   ========================================================= */

function aliasKeys(value) {

    const base =
        normalizeStreet(
            removeHouseNumber(value)
        );

    const result = new Set();

    if (base) {
        result.add(base);
    }

    const aliases =
        STREET_ALIASES[base] || [];

    aliases.forEach(alias => {
        result.add(
            normalizeStreet(alias)
        );
    });

    Object.entries(STREET_ALIASES)
        .forEach(([key, values]) => {

            if (
                values.some(
                    value =>
                        normalizeStreet(value) === base
                )
            ) {
                result.add(
                    normalizeStreet(key)
                );
            }

        });

    return [...result].filter(Boolean);
}


/* =========================================================
   PORÓWNYWANIE ULIC
   ========================================================= */

function sameStreet(a, b) {

    const aa = aliasKeys(a);
    const bb = aliasKeys(b);

    for (const x of aa) {

        if (bb.includes(x)) {
            return true;
        }

    }

    /*
       Obsługa np.
       Bolesława Chrobrego
       Chrobrego
    */

    for (const x of aa) {

        if (x.length < 6) {
            continue;
        }

        for (const y of bb) {

            if (y.length < 6) {
                continue;
            }

            if (
                x.endsWith(" " + y) ||
                y.endsWith(" " + x)
            ) {
                return true;
            }

        }

    }

    return false;
}


/* =========================================================
   WSZYSTKIE ULICE
   Liczone tylko raz.
   ========================================================= */

function allStreets() {

    if (streetListCache) {
        return streetListCache;
    }

    const set = new Set();

    const groups =
        schedule?.streetGroups || {};

    Object.values(groups)
        .forEach(zoneMap => {

            Object.values(zoneMap || {})
                .forEach(list => {

                    (list || [])
                        .forEach(street => {
                            set.add(street);
                        });

                });

        });

    streetListCache =
        [...set].sort(
            (a, b) =>
                a.localeCompare(
                    b,
                    "pl-PL"
                )
        );

    return streetListCache;
}


/* =========================================================
   ZNORMALIZOWANE ULICE
   Liczone tylko raz.
   ========================================================= */

function getNormalizedStreetList() {

    if (normalizedStreetListCache) {
        return normalizedStreetListCache;
    }

    normalizedStreetListCache =
        allStreets().map(street => ({
            street,
            normalized:
                normalizeStreet(street)
        }));

    return normalizedStreetListCache;
}


/* =========================================================
   SZUKANIE ULICY
   ========================================================= */

function findStreet(query) {

    const q =
        removeHouseNumber(query);

    if (!q) {
        return null;
    }

    const nq =
        normalizeStreet(q);

    if (!nq) {
        return null;
    }

    if (streetLookupCache.has(nq)) {

        return streetLookupCache.get(nq);

    }

    const streets =
        allStreets();

    /*
       Najpierw dokładne dopasowanie.
    */

    for (const street of streets) {

        if (sameStreet(q, street)) {

            streetLookupCache.set(
                nq,
                street
            );

            return street;
        }

    }

    /*
       Potem częściowe dopasowanie.
    */

    const normalized =
        getNormalizedStreetList();

    for (const item of normalized) {

        if (
            item.normalized.includes(nq) ||
            nq.includes(item.normalized)
        ) {

            streetLookupCache.set(
                nq,
                item.street
            );

            return item.street;
        }

    }

    streetLookupCache.set(
        nq,
        null
    );

    return null;
}


/* =========================================================
   REGION ZMIESZANYCH
   ========================================================= */

function findMixedRegion(street) {

    const groups =
        schedule?.streetGroups?.mixed || {};

    for (
        const [region, streets]
        of Object.entries(groups)
    ) {

        if (
            (streets || []).some(
                s => sameStreet(street, s)
            )
        ) {

            return region;

        }

    }

    return null;
}


/* =========================================================
   STREFA SEGREGOWANYCH
   ========================================================= */

function findSegregatedZone(street) {

    const groups =
        schedule?.streetGroups?.segregated || {};

    for (
        const [zone, streets]
        of Object.entries(groups)
    ) {

        if (
            (streets || []).some(
                s => sameStreet(street, s)
            )
        ) {

            return zone;

        }

    }

    return null;
}


/* =========================================================
   STREFY ULICY
   CACHE
   ========================================================= */

function getStreetZones(street) {

    if (!street) {

        return {
            mixed: null,
            segregated: null
        };

    }

    const key =
        normalizeStreet(street);

    if (streetZonesCache.has(key)) {

        return streetZonesCache.get(key);

    }

    const zones = {

        mixed:
            findMixedRegion(street),

        segregated:
            findSegregatedZone(street)

    };

    streetZonesCache.set(
        key,
        zones
    );

    return zones;
}


/* =========================================================
   TYP ODPADU
   ========================================================= */

function convertPickupType(type) {

    const value =
        normalizeStreet(type);

    if (
        value.includes("zolty") &&
        value.includes("niebieski")
    ) {

        return [
            "yellow",
            "blue"
        ];

    }

    if (
        value.includes("brazowy") ||
        value.includes("bio")
    ) {

        return [
            "brown"
        ];

    }

    if (
        value.includes("gabaryt")
    ) {

        return [
            "purple"
        ];

    }

    if (
        value.includes("tekstyl")
    ) {

        return [
            "white"
        ];

    }

    if (
        value.includes("szary")
    ) {

        return [
            "gray"
        ];

    }

    if (
        value.includes("zielony")
    ) {

        return [
            "green"
        ];

    }

    return [];

}


/* =========================================================
   ODBIORY DLA ULICY
   CACHE
   ========================================================= */

function getPickupsForStreet(street) {

    if (
        !street ||
        !schedule
    ) {

        return [];

    }

    const canonical =
        findStreet(street) || street;

    if (
        streetScheduleCache.has(canonical)
    ) {

        return streetScheduleCache.get(
            canonical
        );

    }

    const zones =
        getStreetZones(canonical);

    const result = [];


    /* =========================
       ZMIESZANE
       ========================= */

    if (zones.mixed) {

        const region =
            (schedule.mixed || [])
                .find(
                    item =>
                        item.region ===
                        zones.mixed
                );

        if (region) {

            (region.dates || [])
                .forEach(date => {

                    result.push({

                        date,

                        type: "mixed"

                    });

                });

        }

    }


    /* =========================
       SEGREGOWANE
       ========================= */

    if (zones.segregated) {

        const zone =
            (schedule.segregated || [])
                .find(
                    item =>
                        item.zone ===
                        zones.segregated
                );

        if (zone) {

            (zone.pickups || [])
                .forEach(pickup => {

                    const types =
                        convertPickupType(
                            pickup.type
                        );

                    types.forEach(type => {

                        result.push({

                            date:
                                pickup.date,

                            type

                        });

                    });

                });

        }

    }


    result.sort(
        (a, b) =>
            parseDate(a.date) -
            parseDate(b.date)
    );


    /*
       Zapamiętujemy gotowy wynik.
    */

    streetScheduleCache.set(
        canonical,
        result
    );


    return result;
}


/* =========================================================
   MAPA KALENDARZA DLA ULICY
   Najważniejsza optymalizacja.
   Zamiast przeszukiwać cały harmonogram dla każdego dnia,
   robimy mapę daty -> odpady tylko raz.
   ========================================================= */

function buildCalendarCache(street) {

    if (!street) {
        return;
    }

    const canonical =
        findStreet(street) || street;

    const pickups =
        getPickupsForStreet(canonical);

    /*
       Usuwamy stare wpisy tej ulicy.
    */

    for (
        const key
        of calendarDateCache.keys()
    ) {

        if (
            key.startsWith(
                canonical + "|"
            )
        ) {

            calendarDateCache.delete(key);

        }

    }


    const dateMap = new Map();


    pickups.forEach(item => {

        const iso =
            toIsoDate(item.date);

        if (!dateMap.has(iso)) {

            dateMap.set(
                iso,
                []
            );

        }

        const list =
            dateMap.get(iso);

        if (
            !list.includes(item.type)
        ) {

            list.push(
                item.type
            );

        }

    });


    /*
       Zapisujemy każdą datę.
    */

    dateMap.forEach(
        (types, iso) => {

            calendarDateCache.set(
                `${canonical}|${iso}`,
                types
            );

        }
    );

}


/* =========================================================
   ODPADY DLA KONKRETNEJ DATY
   ========================================================= */

function getWasteForDate(
    date,
    street = selectedStreet
) {

    if (!street) {
        return [];
    }

    const canonical =
        findStreet(street) || street;

    const key =
        `${canonical}|${date}`;

    if (
        calendarDateCache.has(key)
    ) {

        return calendarDateCache.get(
            key
        );

    }

    /*
       Jeśli mapa nie została zbudowana,
       budujemy ją tylko raz.
    */

    buildCalendarCache(canonical);

    return (
        calendarDateCache.get(key) ||
        []
    );

}


/* =========================================================
   GRUPOWANIE DAT
   ========================================================= */

function groupByDate(pickups) {

    const map = new Map();

    pickups.forEach(item => {

        if (
            !map.has(item.date)
        ) {

            map.set(
                item.date,
                []
            );

        }

        const list =
            map.get(item.date);

        if (
            !list.includes(item.type)
        ) {

            list.push(
                item.type
            );

        }

    });


    return [
        ...map.entries()
    ]
        .map(
            ([date, types]) => ({
                date,
                types
            })
        )
        .sort(
            (a, b) =>
                parseDate(a.date) -
                parseDate(b.date)
        );

}


/* =========================================================
   NAJBLIŻSZY ODBIÓR
   ========================================================= */

function nextPickup(street) {

    const today =
        new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );

    return groupByDate(
        getPickupsForStreet(street)
    )
        .find(
            item =>
                parseDate(item.date) >=
                today
        ) || null;

}


/* =========================================================
   WYŚWIETLANIE POJEDYNCZEGO ODBIORU
   ========================================================= */

function renderPickup(item) {

    const names =
        item.types
            .map(
                type =>
                    WASTE_TYPES[type].name
            )
            .join(" + ");


    const bags =
        item.types
            .map(type => {

                const bag =
                    WASTE_TYPES[type].bag;

                return bag
                    ? `(${bag})`
                    : "";

            })
            .filter(Boolean)
            .join(" + ");


    return `
        <div class="pickup">

            <div class="ico">
                ♻️
            </div>

            <div>

                <b>
                    ${escapeHtml(names)}
                </b>

                ${
                    bags
                        ? `<small>${escapeHtml(bags)}</small>`
                        : ""
                }

            </div>

            <div class="date">
                ${escapeHtml(
                    formatDate(item.date)
                )}
            </div>

        </div>
    `;

}


/* =========================================================
   POKAZANIE HARMONOGRAMU ULICY
   ========================================================= */

function showStreetSchedule(street) {

    selectedStreet =
        street;

    localStorage.setItem(
        "selectedStreet",
        street
    );


    /*
       Przygotowanie cache
       tylko dla wybranej ulicy.
    */

    getPickupsForStreet(
        street
    );

    buildCalendarCache(
        street
    );


    document
        .getElementById("emptyState")
        ?.classList.add("hidden");


    const card =
        document.getElementById(
            "selectedAddress"
        );

    const text =
        document.getElementById(
            "selectedAddressText"
        );


    if (
        card &&
        text
    ) {

        card.classList.remove(
            "hidden"
        );

        text.textContent =
            street;

    }


    updateFavoriteStar();


    const today =
        new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );


    const upcoming =
        groupByDate(
            getPickupsForStreet(
                street
            )
        )
            .filter(
                item =>
                    parseDate(
                        item.date
                    ) >= today
            );


    const next =
        upcoming[0] || null;


    const result =
        document.getElementById(
            "result"
        );


    if (!result) {
        return;
    }


    if (!upcoming.length) {

        result.innerHTML = `
            <div class="card empty">

                <h2>
                    Brak kolejnych terminów
                </h2>

                <p>
                    Dla tej ulicy nie ma już
                    kolejnych odbiorów
                    w przekazanym harmonogramie.
                </p>

            </div>
        `;

        renderCalendarDetails();

        return;
    }


    result.innerHTML = `

        <div class="next card">

            <small>
                NAJBLIŻSZY ODBIÓR
            </small>

            <h2>
                ${escapeHtml(
                    formatDate(
                        next.date
                    )
                )}
            </h2>

            <p>
                ${escapeHtml(
                    next.types
                        .map(
                            type =>
                                WASTE_TYPES[type].name
                        )
                        .join(" + ")
                )}
            </p>

        </div>


        <div class="card schedule-list">

            <h2>
                Najbliższe odbiory
            </h2>

            ${
                upcoming
                    .slice(0, 10)
                    .map(renderPickup)
                    .join("")
            }

        </div>

    `;


    renderCalendarDetails();

}


/* =========================================================
   WYSZUKIWANIE
   ========================================================= */

function setupSearch() {

    const input =
        document.getElementById(
            "addressSearch"
        );

    const button =
        document.getElementById(
            "searchButton"
        );

    const suggestions =
        document.getElementById(
            "suggestions"
        );


    if (
        !input ||
        !button ||
        !suggestions
    ) {

        return;

    }


    /*
       Opóźnienie wyszukiwania o jedną klatkę.
       Dzięki temu telefon nie wykonuje
       wyszukiwania przy każdym znaku
       natychmiast.
    */

    let frame = null;


    function drawSuggestions() {

        const query =
            input.value.trim();


        if (!query) {

            suggestions.innerHTML =
                "";

            return;

        }


        const nq =
            normalizeStreet(
                removeHouseNumber(
                    query
                )
            );


        if (!nq) {

            suggestions.innerHTML =
                "";

            return;

        }


        const normalized =
            getNormalizedStreetList();


        const matches =
            normalized
                .filter(
                    item =>
                        item.normalized
                            .includes(nq)
                )
                .slice(0, 8)
                .map(
                    item =>
                        item.street
                );


        suggestions.innerHTML =
            matches
                .map(
                    street => `

                        <button
                            class="suggestion"
                            data-street="${escapeAttribute(street)}"
                        >

                            <span>
                                ${escapeHtml(street)}
                            </span>

                            <small>
                                Wybierz
                            </small>

                        </button>

                    `
                )
                .join("");


        suggestions
            .querySelectorAll(
                "[data-street]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        selectStreet(
                            button.dataset.street
                        );

                        suggestions.innerHTML =
                            "";

                        input.value =
                            button.dataset.street;

                    }
                );

            });

    }


    input.addEventListener(
        "input",
        () => {

            if (frame) {
                cancelAnimationFrame(
                    frame
                );
            }

            frame =
                requestAnimationFrame(
                    drawSuggestions
                );

        }
    );


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                searchStreet();

            }

        }
    );


    button.addEventListener(
        "click",
        searchStreet
    );


    function searchStreet() {

        const found =
            findStreet(
                input.value
            );


        if (!found) {

            suggestions.innerHTML = "";

            const result =
                document.getElementById(
                    "result"
                );

            if (result) {

                result.innerHTML = `
                    <div class="card empty">

                        <h2>
                            Nie znaleziono ulicy
                        </h2>

                        <p>
                            Sprawdź nazwę ulicy
                            i spróbuj ponownie.
                        </p>

                    </div>
                `;

            }

            return;

        }


        suggestions.innerHTML =
            "";

        input.value =
            found;

        selectStreet(
            found
        );

    }

}


/* =========================================================
   WYBÓR ULICY
   ========================================================= */

function selectStreet(street) {

    const found =
        findStreet(street) ||
        street;

    showStreetSchedule(
        found
    );

    switchPage(
        "home"
    );

}


/* =========================================================
   NAWIGACJA
   ========================================================= */

function setupNavigation() {

    document
        .querySelectorAll(
            "[data-page]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () =>
                    switchPage(
                        button.dataset.page
                    )
            );

        });


    document
        .querySelectorAll(
            "[data-home]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () =>
                    switchPage(
                        "home"
                    )
            );

        });


    document
        .getElementById(
            "homeSettings"
        )
        ?.addEventListener(
            "click",
            () =>
                switchPage(
                    "settings"
                )
        );

}


/* =========================================================
   ZMIANA STRONY
   ========================================================= */

function switchPage(page) {

    document
        .querySelectorAll(".page")
        .forEach(p =>
            p.classList.remove(
                "active"
            )
        );


    document
        .getElementById(
            `${page}Page`
        )
        ?.classList.add(
            "active"
        );


    document
        .querySelectorAll(
            "nav [data-page]"
        )
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.page === page
            );

        });


    if (
        page === "favorites"
    ) {

        renderFavorites();

    }


    if (
        page === "calendar"
    ) {

        renderCalendar();

        renderCalendarDetails();

    }

}


/* =========================================================
   KALENDARZ
   ========================================================= */

function renderCalendar() {

    const calendar =
        document.getElementById(
            "calendar"
        );

    const title =
        document.getElementById(
            "monthTitle"
        );


    if (!calendar) {
        return;
    }


    const first =
        new Date(
            currentYear,
            currentMonth,
            1
        );


    const days =
        new Date(
            currentYear,
            currentMonth + 1,
            0
        ).getDate();


    const offset =
        (
            first.getDay() + 6
        ) % 7;


    if (title) {

        title.textContent =
            first.toLocaleDateString(
                "pl-PL",
                {
                    month: "long",
                    year: "numeric"
                }
            );

    }


    const today =
        new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );


    let html = `

        <div class="calendar-weekdays">

            <span>Pn</span>
            <span>Wt</span>
            <span>Śr</span>
            <span>Cz</span>
            <span>Pt</span>
            <span>So</span>
            <span>Nd</span>

        </div>

        <div class="calendar-grid">

    `;


    /*
       Puste pola przed pierwszym dniem.
    */

    for (
        let i = 0;
        i < offset;
        i++
    ) {

        html += `
            <div
                class="calendar-day empty"
            ></div>
        `;

    }


    /*
       Dni miesiąca.
    */

    for (
        let day = 1;
        day <= days;
        day++
    ) {

        const iso =
            `${currentYear}-${String(
                currentMonth + 1
            ).padStart(2, "0")}-${String(
                day
            ).padStart(2, "0")}`;


        const types =
            getWasteForDate(
                iso
            );


        const isToday =
            today.getFullYear() ===
                currentYear &&
            today.getMonth() ===
                currentMonth &&
            today.getDate() ===
                day;


        html += `

            <button
                class="calendar-day ${
                    types.length
                        ? "has-pickup"
                        : ""
                } ${
                    isToday
                        ? "today"
                        : ""
                }"
                data-date="${iso}"
            >

                <span class="day-number">
                    ${day}
                </span>

                <div class="day-dots">

                    ${
                        types
                            .map(
                                type => `

                                    <span
                                        class="calendar-dot"
                                        style="background:${WASTE_TYPES[type].color}"
                                        title="${escapeAttribute(
                                            WASTE_TYPES[type].name
                                        )}"
                                    ></span>

                                `
                            )
                            .join("")
                    }

                </div>

            </button>

        `;

    }


    html += `
        </div>

        <div class="calendar-legend">

            <h3>
                Legenda kolorów
            </h3>

            <div class="legend-grid">

                ${
                    Object.entries(
                        WASTE_TYPES
                    )
                        .map(
                            ([key, value]) => `

                                <div
                                    class="legend-item"
                                >

                                    <span
                                        class="legend-dot"
                                        style="background:${value.color}"
                                    ></span>

                                    <span>
                                        ${escapeHtml(
                                            value.name
                                        )}
                                    </span>

                                </div>

                            `
                        )
                        .join("")
                }

            </div>

        </div>
    `;


    calendar.innerHTML =
        html;


    /*
       Jeden listener na cały kalendarz
       zamiast osobnego listenera
       dla każdego dnia.
    */

    calendar.onclick =
        event => {

            const button =
                event.target.closest(
                    "[data-date]"
                );

            if (!button) {
                return;
            }

            showCalendarDay(
                button.dataset.date
            );

        };

}


/* =========================================================
   SZCZEGÓŁY DNIA KALENDARZA
   ========================================================= */

function showCalendarDay(iso) {

    const details =
        document.getElementById(
            "calendarDetails"
        );


    if (!details) {
        return;
    }


    const types =
        getWasteForDate(
            iso
        );


    const date =
        formatIsoDate(
            iso
        );


    if (!types.length) {

        details.innerHTML = `

            <h3>
                ${escapeHtml(date)}
            </h3>

            <p>
                Brak odbioru dla wybranego adresu.
            </p>

        `;

        return;

    }


    details.innerHTML = `

        <h3>
            ${escapeHtml(date)}
        </h3>

        ${
            types
                .map(type => `

                    <div class="line">

                        <b>
                            ${escapeHtml(
                                WASTE_TYPES[type].name
                            )}
                        </b>

                        ${
                            WASTE_TYPES[type].bag
                                ? `<small>
                                    ${escapeHtml(
                                        WASTE_TYPES[type].bag
                                    )}
                                   </small>`
                                : ""
                        }

                    </div>

                `)
                .join("")
        }

    `;

}


/* =========================================================
   SZCZEGÓŁY KALENDARZA
   ========================================================= */

function renderCalendarDetails() {

    const details =
        document.getElementById(
            "calendarDetails"
        );


    if (!details) {
        return;
    }


    if (!selectedStreet) {

        details.innerHTML = `

            <h3>
                Terminy dla wybranego adresu
            </h3>

            <p>
                Wybierz ulicę na ekranie Start,
                aby zobaczyć jej terminy
                w kalendarzu.
            </p>

        `;

        return;

    }


    const zones =
        getStreetZones(
            selectedStreet
        );


    details.innerHTML = `

        <h3>
            ${escapeHtml(
                selectedStreet
            )}
        </h3>

        <p>
            Zmieszane:
            <b>
                ${zones.mixed || "brak w danych"}
            </b>

            ·

            Segregowane:
            <b>
                ${zones.segregated || "brak w danych"}
            </b>
        </p>

    `;

}


/* =========================================================
   ZMIANA MIESIĄCA
   ========================================================= */

function changeMonth(delta) {

    currentMonth += delta;


    if (
        currentMonth < 0
    ) {

        currentMonth = 11;
        currentYear--;

    }


    if (
        currentMonth > 11
    ) {

        currentMonth = 0;
        currentYear++;

    }


    renderCalendar();

}


/* =========================================================
   PRZYCISKI KALENDARZA
   ========================================================= */

document.addEventListener(
    "click",
    event => {

        if (
            event.target.id === "prev"
        ) {

            changeMonth(-1);

        }


        if (
            event.target.id === "next"
        ) {

            changeMonth(1);

        }

    }
);


/* =========================================================
   ULUBIONE
   ========================================================= */

function getFavorites() {

    try {

        return JSON.parse(
            localStorage.getItem(
                "favorites"
            ) || "[]"
        );

    } catch {

        return [];

    }

}


function saveFavorites(items) {

    localStorage.setItem(
        "favorites",
        JSON.stringify(items)
    );

}


/* =========================================================
   GWIAZDKA
   ========================================================= */

function updateFavoriteStar() {

    const button =
        document.getElementById(
            "favoriteCurrent"
        );


    if (!button) {
        return;
    }


    const exists =
        getFavorites()
            .some(
                item =>
                    sameStreet(
                        item.street,
                        selectedStreet
                    )
            );


    button.textContent =
        exists
            ? "★"
            : "☆";

}


/* =========================================================
   MODAL ULUBIONYCH
   ========================================================= */

function openFavoriteModal(street) {

    pendingFavoriteStreet =
        street;


    const address =
        document.getElementById(
            "modalAddress"
        );

    if (address) {

        address.textContent =
            street;

    }


    const name =
        document.getElementById(
            "favoriteName"
        );

    if (name) {

        name.value =
            street;

    }


    document
        .getElementById(
            "modal"
        )
        ?.classList.remove(
            "hidden"
        );


    setTimeout(
        () => {

            document
                .getElementById(
                    "favoriteName"
                )
                ?.focus();

        },
        50
    );

}


/* =========================================================
   ZAMKNIĘCIE MODALA
   ========================================================= */

function closeModal() {

    document
        .getElementById(
            "modal"
        )
        ?.classList.add(
            "hidden"
        );


    pendingFavoriteStreet =
        "";

}


/* =========================================================
   ZAPIS ULUBIONEGO
   ========================================================= */

function saveFavorite() {

    if (
        !pendingFavoriteStreet
    ) {

        return;

    }


    const input =
        document.getElementById(
            "favoriteName"
        );


    const name =
        input?.value.trim() ||
        pendingFavoriteStreet;


    const favorites =
        getFavorites()
            .filter(
                item =>
                    !sameStreet(
                        item.street,
                        pendingFavoriteStreet
                    )
            );


    favorites.push({

        street:
            pendingFavoriteStreet,

        name

    });


    saveFavorites(
        favorites
    );


    closeModal();

    updateFavoriteStar();

    renderFavorites();

}


/* =========================================================
   USUNIĘCIE ULUBIONEGO
   ========================================================= */

function removeFavorite(street) {

    saveFavorites(

        getFavorites()
            .filter(
                item =>
                    !sameStreet(
                        item.street,
                        street
                    )
            )

    );


    renderFavorites();

    updateFavoriteStar();

}


/* =========================================================
   RENDER ULUBIONYCH
   ========================================================= */

function renderFavorites() {

    const list =
        document.getElementById(
            "favoritesList"
        );

    const empty =
        document.getElementById(
            "favoritesEmpty"
        );


    if (
        !list ||
        !empty
    ) {

        return;

    }


    const favorites =
        getFavorites();


    empty.classList.toggle(
        "hidden",
        favorites.length > 0
    );


    list.innerHTML =
        favorites
            .map(
                item => `

                    <div
                        class="favorite card"
                    >

                        <div
                            class="star2"
                        >
                            ★
                        </div>

                        <div
                            class="fi"
                        >

                            <b>
                                ${escapeHtml(
                                    item.name
                                )}
                            </b>

                            <small>
                                ${escapeHtml(
                                    item.street
                                )}
                            </small>

                        </div>

                        <button
                            data-open-fav="${escapeAttribute(
                                item.street
                            )}"
                        >
                            Otwórz
                        </button>

                        <button
                            class="del"
                            data-del-fav="${escapeAttribute(
                                item.street
                            )}"
                        >
                            Usuń
                        </button>

                    </div>

                `
            )
            .join("");


    /*
       Jeden listener zamiast wielu.
    */

    list.onclick =
        event => {

            const open =
                event.target.closest(
                    "[data-open-fav]"
                );

            if (open) {

                selectStreet(
                    open.dataset.openFav
                );

                return;

            }


            const remove =
                event.target.closest(
                    "[data-del-fav]"
                );

            if (remove) {

                removeFavorite(
                    remove.dataset.delFav
                );

            }

        };

}


/* =========================================================
   USTAWIENIA
   ========================================================= */

function setupSettings() {

    const dark =
        document.getElementById(
            "dark"
        );

    const notifications =
        document.getElementById(
            "notifications"
        );


    const savedDark =
        localStorage.getItem(
            "dark"
        ) === "true";


    if (dark) {

        dark.checked =
            savedDark;

        document.body.classList.toggle(
            "dark",
            savedDark
        );


        dark.addEventListener(
            "change",
            () => {

                localStorage.setItem(
                    "dark",
                    dark.checked
                );

                document.body.classList.toggle(
                    "dark",
                    dark.checked
                );

            }
        );

    }


    if (notifications) {

        notifications.checked =
            localStorage.getItem(
                "notifications"
            ) === "true";


        notifications.addEventListener(
            "change",
            async () => {

                if (
                    notifications.checked &&
                    "Notification" in window &&
                    Notification.permission ===
                        "default"
                ) {

                    await Notification.requestPermission();

                }


                const granted =
                    notifications.checked &&
                    (
                        !("Notification" in window) ||
                        Notification.permission ===
                            "granted"
                    );


                notifications.checked =
                    granted;


                localStorage.setItem(
                    "notifications",
                    granted
                        ? "true"
                        : "false"
                );

            }
        );

    }


    document
        .getElementById(
            "clearFavorites"
        )
        ?.addEventListener(
            "click",
            () => {

                if (
                    confirm(
                        "Usunąć wszystkie ulubione adresy?"
                    )
                ) {

                    saveFavorites([]);

                    renderFavorites();

                    updateFavoriteStar();

                }

            }
        );


    document
        .getElementById(
            "about"
        )
        ?.addEventListener(
            "click",
            () => {

                alert(
                    "Sochaczew Odpady\nHarmonogram 2026"
                );

            }
        );

}


/* =========================================================
   ULUBIONA AKTUALNA ULICA
   ========================================================= */

function setupFavorite() {

    document
        .getElementById(
            "favoriteCurrent"
        )
        ?.addEventListener(
            "click",
            () => {

                if (!selectedStreet) {
                    return;
                }


                const exists =
                    getFavorites()
                        .some(
                            item =>
                                sameStreet(
                                    item.street,
                                    selectedStreet
                                )
                        );


                if (exists) {

                    removeFavorite(
                        selectedStreet
                    );

                } else {

                    openFavoriteModal(
                        selectedStreet
                    );

                }

            }
        );


    document
        .querySelectorAll(
            "[data-close]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                closeModal
            );

        });


    document
        .getElementById(
            "saveFavorite"
        )
        ?.addEventListener(
            "click",
            saveFavorite
        );


    document
        .getElementById(
            "favoriteName"
        )
        ?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    saveFavorite();

                }

            }
        );

}


/* =========================================================
   WCZYTANIE ZAPISANEJ ULICY
   ========================================================= */

function loadSavedStreet() {

    if (!selectedStreet) {
        return;
    }


    const found =
        findStreet(
            selectedStreet
        );


    if (found) {

        showStreetSchedule(
            found
        );

    }

}


/* =========================================================
   DATY
   ========================================================= */

function parseDate(value) {

    const [
        d,
        m,
        y
    ] =
        String(value)
            .split(".")
            .map(Number);


    return new Date(
        y,
        m - 1,
        d
    );

}


function formatDate(value) {

    return parseDate(
        value
    ).toLocaleDateString(
        "pl-PL",
        {
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

}


function toPolishDate(iso) {

    const [
        y,
        m,
        d
    ] =
        iso.split("-");


    return `${d}.${m}.${y}`;

}


/* =========================================================
   POLSKA DATA -> ISO
   ========================================================= */

function toIsoDate(value) {

    const [
        d,
        m,
        y
    ] =
        String(value)
            .split(".");


    return `${y}-${m}-${d}`;

}


/* =========================================================
   ISO -> POLSKA DATA
   ========================================================= */

function formatIsoDate(iso) {

    const [
        y,
        m,
        d
    ] =
        iso.split("-");


    return new Date(
        Number(y),
        Number(m) - 1,
        Number(d)
    ).toLocaleDateString(
        "pl-PL",
        {
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

}


/* =========================================================
   BEZPIECZNE HTML
   ========================================================= */

function escapeHtml(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


function escapeAttribute(value) {

    return escapeHtml(
        value
    ).replace(
        /`/g,
        "&#096;"
    );

}


/* =========================================================
   START APLIKACJI
   ========================================================= */

async function start() {

    try {

        const response =
            await fetch(
                "./data/schedule.json",
                {
                    /*
                       Zostawiamy cache przeglądarki.
                       Dzięki temu telefon nie musi
                       za każdym razem pobierać danych
                       od nowa.
                    */
                    cache: "default"
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        schedule =
            await response.json();


        if (
            !schedule.streetGroups ||
            !schedule.mixed ||
            !schedule.segregated
        ) {

            throw new Error(
                "Nieprawidłowy format harmonogramu"
            );

        }


        /*
           Czyścimy cache po załadowaniu
           nowego harmonogramu.
        */

        streetListCache =
            null;

        normalizedStreetListCache =
            null;

        streetLookupCache.clear();

        streetZonesCache.clear();

        streetScheduleCache.clear();

        calendarDateCache.clear();


        /*
           Przygotowanie listy ulic tylko raz.
        */

        allStreets();

        getNormalizedStreetList();


        /*
           Uruchomienie aplikacji.
        */

        setupSearch();

        setupNavigation();

        setupSettings();

        setupFavorite();

        renderFavorites();

        renderCalendar();

        loadSavedStreet();


    } catch (error) {

        console.error(
            error
        );


        const result =
            document.getElementById(
                "result"
            );


        if (result) {

            result.innerHTML = `

                <div class="error-box">

                    <strong>
                        Błąd danych
                    </strong>

                    <p>
                        Nie udało się
                        wczytać harmonogramu.
                    </p>

                    <small>
                        ${escapeHtml(
                            error.message
                        )}
                    </small>

                </div>

            `;

        }

    }

}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    start
);
