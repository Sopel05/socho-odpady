/* =========================================================
   SOCHACZEW ODPADY
   Pełny plik app.js
   ========================================================= */

/* ===== KOLORY I NAZWY ODPADÓW =====
   Jeśli kiedyś będziesz chciał zmienić kolor,
   zmieniasz go tylko tutaj.
*/
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
        bag: "worek czarny",
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
   ZMIENNE APLIKACJI
   ========================================================= */

let schedule = null;

let selectedStreet =
    localStorage.getItem("selectedStreet") || "";

let currentMonth = new Date().getMonth();

let currentYear = new Date().getFullYear();

let pendingFavoriteStreet = "";


/* =========================================================
   ALIASY ULIC
   Dane mieszane i segregowane mają czasami różne nazwy
   tej samej ulicy.
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
   NORMALIZACJA NAZW ULIC
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
   ALIASY
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

            const normalizedKey =
                normalizeStreet(key);

            const found =
                values.some(
                    value =>
                        normalizeStreet(value) === base
                );

            if (found) {
                result.add(normalizedKey);
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

    if (
        aa.some(
            value =>
                bb.includes(value)
        )
    ) {
        return true;
    }

    /*
      Obsługa np.
      "Bolesława Chrobrego"
      oraz
      "Chrobrego"
    */

    return aa.some(x =>
        bb.some(y => {

            if (
                x.length < 6 ||
                y.length < 6
            ) {
                return false;
            }

            return (
                x.endsWith(" " + y) ||
                y.endsWith(" " + x)
            );
        })
    );
}


/* =========================================================
   WSZYSTKIE ULICE
   ========================================================= */

function allStreets() {

    const result = new Set();

    const groups =
        schedule?.streetGroups || {};

    Object.values(groups)
        .forEach(zoneMap => {

            Object.values(zoneMap || {})
                .forEach(list => {

                    (list || [])
                        .forEach(street => {

                            result.add(street);

                        });

                });

        });

    return [...result]
        .sort(
            (a, b) =>
                a.localeCompare(
                    b,
                    "pl-PL"
                )
        );
}


/* =========================================================
   SZUKANIE ULICY
   ========================================================= */

function findStreet(query) {

    const withoutNumber =
        removeHouseNumber(query);

    if (!withoutNumber) {
        return null;
    }

    const streets =
        allStreets();

    /* Najpierw dokładne dopasowanie */

    const exact =
        streets.find(
            street =>
                sameStreet(
                    withoutNumber,
                    street
                )
        );

    if (exact) {
        return exact;
    }

    /* Potem częściowe */

    const normalizedQuery =
        normalizeStreet(
            withoutNumber
        );

    return streets.find(street => {

        const normalizedStreet =
            normalizeStreet(street);

        return (
            normalizedStreet.includes(
                normalizedQuery
            ) ||
            normalizedQuery.includes(
                normalizedStreet
            )
        );

    }) || null;
}


/* =========================================================
   ZNAJDOWANIE REGIONU ZMIESZANYCH
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
                item =>
                    sameStreet(
                        street,
                        item
                    )
            )
        ) {

            return region;

        }

    }

    return null;
}


/* =========================================================
   ZNAJDOWANIE STREFY SEGREGOWANYCH
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
                item =>
                    sameStreet(
                        street,
                        item
                    )
            )
        ) {

            return zone;

        }

    }

    return null;
}


/* =========================================================
   STREFY DLA KONKRETNEJ ULICY
   ========================================================= */

function getStreetZones(street) {

    return {

        mixed:
            findMixedRegion(street),

        segregated:
            findSegregatedZone(street)

    };
}


/* =========================================================
   KONWERSJA RODZAJU ODPADU
   ========================================================= */

function convertPickupType(type) {

    const value =
        normalizeStreet(type);

    /*
      Żółty + niebieski
      MUSZĄ zostać dwoma osobnymi rodzajami.
    */

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
   TERMINY DLA KONKRETNEJ ULICY
   ========================================================= */

function getPickupsForStreet(street) {

    if (!street) {
        return [];
    }

    const zones =
        getStreetZones(street);

    const result = [];


    /* -----------------------------------------
       ODPADY ZMIESZANE
       ----------------------------------------- */

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

                        date: date,

                        type: "mixed"

                    });

                });

        }

    }


    /* -----------------------------------------
       ODPADY SEGREGOWANE
       ----------------------------------------- */

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

                            type:
                                type

                        });

                    });

                });

        }

    }


    return result.sort(
        (a, b) =>
            parseDate(a.date) -
            parseDate(b.date)
    );
}


/* =========================================================
   ODPADY W KONKRETNYM DNIU
   ========================================================= */

function getWasteForDate(
    date,
    street = selectedStreet
) {

    if (!street) {
        return [];
    }

    const wantedDate =
        toPolishDate(date);

    const pickups =
        getPickupsForStreet(
            street
        );

    return [
        ...new Set(

            pickups
                .filter(
                    item =>
                        item.date ===
                        wantedDate
                )
                .map(
                    item =>
                        item.type
                )

        )
    ];
}


/* =========================================================
   GRUPOWANIE TERMINÓW PO DACIE
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
            !list.includes(
                item.type
            )
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
        getPickupsForStreet(
            street
        )
    ).find(
        item =>
            parseDate(
                item.date
            ) >= today
    ) || null;
}


/* =========================================================
   WYŚWIETLENIE TERMINU
   ========================================================= */

function renderPickup(item) {

    const names =
        item.types
            .map(
                type =>
                    WASTE_TYPES[type]
                        .name
            )
            .join(" + ");


    const bags =
        item.types

            .map(type => {

                const bag =
                    WASTE_TYPES[type]
                        .bag;

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

                <small>
                    ${escapeHtml(bags)}
                </small>
            </div>

            <div class="date">
                ${escapeHtml(
                    formatDate(
                        item.date
                    )
                )}
            </div>

        </div>
    `;
}


/* =========================================================
   POKAZANIE HARMONOGRAMU ULICY
   ========================================================= */

function showStreetSchedule(street) {

    selectedStreet = street;

    localStorage.setItem(
        "selectedStreet",
        street
    );

    const emptyState =
        document.getElementById(
            "emptyState"
        );

    if (emptyState) {
        emptyState.classList.add("hidden");
    }

    const addressCard =
        document.getElementById(
            "selectedAddress"
        );

    const addressText =
        document.getElementById(
            "selectedAddressText"
        );

    if (
        addressCard &&
        addressText
    ) {
        addressCard.classList.remove("hidden");
        addressText.textContent = street;
    }

    updateFavoriteStar();

    /*
     * POBIERAMY TERMINY DLA WYBRANEJ ULICY
     */
    const allPickups =
        getPickupsForStreet(street);

    /*
     * DZISIAJ - godzina 00:00
     *
     * Dzięki temu termin dzisiejszy
     * nadal jest traktowany jako najbliższy.
     */
    const today =
        new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );

    /*
     * USUWAMY WSZYSTKIE TERMINY,
     * KTÓRE JUŻ MINĘŁY.
     */
    const upcomingPickups =
        allPickups.filter(
            item =>
                parseDate(item.date) >= today
        );

    /*
     * Grupujemy pozostałe terminy
     * według daty.
     */
    const pickups =
        groupByDate(
            upcomingPickups
        );

    /*
     * Najbliższy termin.
     */
    const next =
        pickups.length
            ? pickups[0]
            : null;

    const result =
        document.getElementById(
            "result"
        );

    if (!result) {
        return;
    }

    /*
     * Jeżeli nie ma już żadnego
     * przyszłego terminu.
     */
    if (!pickups.length) {

        result.innerHTML = `

            <div class="card empty">

                <h2>
                    Brak kolejnych odbiorów
                </h2>

                <p>
                    Wszystkie dostępne terminy
                    dla tej ulicy już minęły.
                </p>

            </div>

        `;

        renderCalendarDetails();

        return;
    }

    /*
     * WYŚWIETLAMY TYLKO PRZYSZŁE TERMINY.
     */
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
                                WASTE_TYPES[
                                    type
                                ].name
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
                pickups
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


    function drawSuggestions() {

        const query =
            input.value.trim();


        if (!query) {

            suggestions.innerHTML =
                "";

            return;
        }


        const normalized =
            normalizeStreet(
                removeHouseNumber(
                    query
                )
            );


        const matches =
            allStreets()

                .filter(
                    street =>
                        normalizeStreet(
                            street
                        ).includes(
                            normalized
                        )
                )

                .slice(0, 8);


        suggestions.innerHTML =
            matches

                .map(
                    street => `

                        <button
                            class="suggestion"
                            data-street="${escapeAttribute(street)}"
                            type="button"
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

                        const street =
                            button.dataset.street;

                        input.value =
                            street;

                        suggestions.innerHTML =
                            "";

                        selectStreet(
                            street
                        );

                    }
                );

            });
    }


    input.addEventListener(
        "input",
        drawSuggestions
    );


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                doSearch();

            }

        }
    );


    button.addEventListener(
        "click",
        doSearch
    );


    function doSearch() {

        const found =
            findStreet(
                input.value
            );


        suggestions.innerHTML =
            "";


        if (!found) {

            document
                .getElementById(
                    "emptyState"
                )
                ?.classList
                .add("hidden");


            const result =
                document.getElementById(
                    "result"
                );


            if (result) {

                result.innerHTML = `

                    <div class="error-box">

                        <strong>
                            Nie znaleziono ulicy
                        </strong>

                        <p>
                            Sprawdź pisownię
                            lub wybierz ulicę
                            z podpowiedzi.
                        </p>

                    </div>

                `;

            }

            return;
        }


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

    showStreetSchedule(
        street
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
                () => {

                    switchPage(
                        button.dataset.page
                    );

                }
            );

        });
}


/* =========================================================
   ZMIANA STRONY
   ========================================================= */

function switchPage(page) {

    document
        .querySelectorAll(
            ".page"
        )

        .forEach(element => {

            element.classList.remove(
                "active"
            );

        });


    const target =
        document.getElementById(
            `${page}Page`
        );


    if (target) {

        target.classList.add(
            "active"
        );

    }


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
        page ===
        "favorites"
    ) {

        renderFavorites();

    }


    if (
        page ===
        "calendar"
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


        const today =
            new Date();


        const isToday =
            today.getFullYear() ===
                currentYear &&

            today.getMonth() ===
                currentMonth &&

            today.getDate() ===
                day;


        html += `

            <button
                type="button"
                class="calendar-day
                    ${types.length
                        ? "has-pickup"
                        : ""}
                    ${isToday
                        ? "today"
                        : ""}"
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


    calendar
        .querySelectorAll(
            "[data-date]"
        )

        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showCalendarDay(
                        button.dataset.date
                    );

                }
            );

        });
}


/* =========================================================
   SZCZEGÓŁY DNIA W KALENDARZU
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
                .map(
                    type => `

                        <div class="line">

                            <b>
                                ${escapeHtml(
                                    WASTE_TYPES[
                                        type
                                    ].name
                                )}
                            </b>

                            <small>
                                ${
                                    WASTE_TYPES[
                                        type
                                    ].bag
                                        ? `(${escapeHtml(
                                            WASTE_TYPES[
                                                type
                                            ].bag
                                        )})`
                                        : ""
                                }
                            </small>

                        </div>

                    `
                )
                .join("")
        }

    `;
}


/* =========================================================
   INFORMACJA O WYBRANYM ADRESIE
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
                ${escapeHtml(
                    zones.mixed ||
                    "brak w danych"
                )}
            </b>

            ·

            Segregowane:
            <b>
                ${escapeHtml(
                    zones.segregated ||
                    "brak w danych"
                )}
            </b>
        </p>

    `;
}


/* =========================================================
   ZMIANA MIESIĄCA
   ========================================================= */

function changeMonth(delta) {

    currentMonth +=
        delta;


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
   PRZYCISKI POPRZEDNI / NASTĘPNY MIESIĄC
   ========================================================= */

document.addEventListener(
    "click",
    event => {

        if (
            event.target.id ===
            "prev"
        ) {

            changeMonth(-1);

        }


        if (
            event.target.id ===
            "next"
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
   GWIAZDKA ULUBIONYCH
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
        getFavorites().some(
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
   MODAL ULUBIONEGO
   ========================================================= */

function openFavoriteModal(street) {

    pendingFavoriteStreet =
        street;


    const address =
        document.getElementById(
            "modalAddress"
        );


    const name =
        document.getElementById(
            "favoriteName"
        );


    if (address) {
        address.textContent =
            street;
    }


    if (name) {
        name.value =
            street;
    }


    document
        .getElementById(
            "modal"
        )
        ?.classList
        .remove("hidden");


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
        ?.classList
        .add("hidden");


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

        name:
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
   USUWANIE ULUBIONEGO
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
   WYŚWIETLANIE ULUBIONYCH
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

                        <div class="star2">
                            ★
                        </div>

                        <div class="fi">

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
                            type="button"
                            data-open-fav="${escapeAttribute(
                                item.street
                            )}"
                        >
                            Otwórz
                        </button>

                        <button
                            type="button"
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


    list
        .querySelectorAll(
            "[data-open-fav]"
        )

        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    selectStreet(
                        button.dataset.openFav
                    );

                }
            );

        });


    list
        .querySelectorAll(
            "[data-del-fav]"
        )

        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    removeFavorite(
                        button.dataset.delFav
                    );

                }
            );

        });
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


    /* TRYB CIEMNY */

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


    /* POWIADOMIENIA */

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


    /* WYCZYŚĆ ULUBIONE */

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


    /* INFORMACJE */

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
   OBSŁUGA GWIAZDKI
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
                    getFavorites().some(
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

        .forEach(element => {

            element.addEventListener(
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

    const parts =
        String(value)
            .split(".")
            .map(Number);


    const day =
        parts[0];

    const month =
        parts[1];

    const year =
        parts[2];


    return new Date(
        year,
        month - 1,
        day
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

    const parts =
        iso.split("-");


    const year =
        parts[0];

    const month =
        parts[1];

    const day =
        parts[2];


    return `${day}.${month}.${year}`;
}


function formatIsoDate(iso) {

    const parts =
        iso.split("-");


    const year =
        Number(parts[0]);

    const month =
        Number(parts[1]);

    const day =
        Number(parts[2]);


    return new Date(
        year,
        month - 1,
        day
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
                    cache:
                        "no-store"
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
            !schedule ||
            !schedule.streetGroups ||
            !schedule.mixed ||
            !schedule.segregated
        ) {

            throw new Error(
                "Nieprawidłowy format harmonogramu"
            );

        }


        setupSearch();

        setupNavigation();

        setupSettings();

        setupFavorite();

        renderFavorites();

        renderCalendar();

        loadSavedStreet();


    } catch (error) {

        console.error(
            "Błąd aplikacji:",
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
                        Nie udało się wczytać
                        harmonogramu.
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
   URUCHOMIENIE
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    start
);
