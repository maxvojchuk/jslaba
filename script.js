const COUNTRIES_API = 'https://countriesnow.space/api/v0.1';
const WORLD_BANK_API = 'https://api.worldbank.org/v2';
const selectElement = document.getElementById('countrySelect');
const infoContainer = document.getElementById('countryInfo');
const countriesByName = new Map();
let countryRequestId = 0;

// Перевіряє HTTP-статус і повертає відповідь у форматі JSON.
async function fetchJson(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        if (!response.ok) {
            throw new Error(Сервер повернув статус ${response.status});
        }

        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Час очікування відповіді API вичерпано');
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

// Додає рядок із назвою параметра та його текстовим значенням.
function addInfoRow(container, label, value) {
    const row = document.createElement('div');
    const title = document.createElement('strong');

    title.textContent = ${label}: ;
    row.append(title, document.createTextNode(value));
    container.appendChild(row);
}

// Отримує населення з актуальних даних Світового банку.
async function getWorldBankPopulation(iso3) {
    const url = ${WORLD_BANK_API}/country/${encodeURIComponent(iso3)}/indicator/SP.POP.TOTL?format=json&mrnev=1&per_page=1;
    const data = await fetchJson(url);
    const population = Array.isArray(data) && Array.isArray(data[1])
        ? data[1].find(item => typeof item.value === 'number')
        : null;

    if (!population) {
        throw new Error('Світовий банк не повернув дані про населення');
    }

    return { value: population.value, year: population.date };
}

// Якщо Світовий банк не має даних, використовує резервний API.
async function getPopulation(country) {
    try {
        return await getWorldBankPopulation(country.iso3);
    } catch (worldBankError) {
        console.warn('Не вдалося отримати актуальне населення зі Світового банку:', worldBankError);

        try {
            const data = await fetchJson(${COUNTRIES_API}/countries/population, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ country: country.name })
            });
            const counts = data.data?.populationCounts;
            const latestCount = Array.isArray(counts)
                ? counts
                    .filter(item => typeof item.value === 'number')
                    .sort((first, second) => Number(second.year) - Number(first.year))[0]
                : null;

            if (!latestCount) {
                throw new Error(data.msg  'Резервне джерело не повернуло дані про населення');
            }

            return { value: latestCount.value, year: latestCount.year };
        } catch (fallbackError) {
            console.error(
                `Не вдалося отримати населення для ${country.name}. ` +
                `Світовий банк: ${worldBankError.message}; ` +
                `резервне джерело: ${fallbackError.message}`
            );
            return null;
        }
    }
}

// Отримує регіон країни зі Світового банку.
async function getRegion(iso3) {
    try {
        const data = await fetchJson(
            `${WORLD_BANK_API}/country/${encodeURIComponent(iso3)}?format=json`
        );
        const region = Array.isArray(data) ? data[1]?.[0]?.region?.value : null;
        return region  'Не вказано';
    } catch (error) {
        console.warn('Не вдалося отримати регіон країни:', error);
        return 'Не вдалося завантажити';
    }
}
// Завантажує назви, прапори та основні дані для випадаючого списку.
async function loadCountries() {
    try {
        const data = await fetchJson(
            ${COUNTRIES_API}/countries/info?returns=name,flag,capital,currency,iso2,iso3
        );
        if (data.error  !Array.isArray(data.data)) {
            throw new Error(data.msg  'API повернув некоректний список країн');
        }

        const countries = data.data
            .filter(country => country.name && country.iso3)
            .sort((first, second) => first.name.localeCompare(second.name, 'uk'));

        if (countries.length === 0) {
            throw new Error('API не повернув жодної країни');
        }

        for (const country of countries) {
            countriesByName.set(country.name, country);
        }

        const options = countries.map(country => new Option(country.name, country.name));
        selectElement.replaceChildren(new Option('Оберіть країну...', ''), ...options);
        selectElement.disabled = false;

        const message = document.createElement('p');
        message.textContent = 'Оберіть країну зі списку, щоб переглянути дані.';
        infoContainer.replaceChildren(message);
    } catch (error) {
        console.error('Помилка завантаження списку країн:', error);
        selectElement.replaceChildren(new Option('Не вдалося завантажити країни', ''));
        infoContainer.textContent =
            'Не вдалося завантажити список країн. Перевірте з’єднання та оновіть сторінку.';
    }
}

// Динамічно показує дані вибраної країни.
async function showCountry(countryName) {
    const requestId = ++countryRequestId;
    const country = countriesByName.get(countryName);

    if (!countryName  !country) {
        infoContainer.textContent = 'Оберіть країну зі списку, щоб переглянути дані.';
        return;
    }

    infoContainer.textContent = 'Завантаження даних...';

    try {
        const [population, region] = await Promise.all([
            getPopulation(country),
            getRegion(country.iso3)
        ]);

        if (requestId !== countryRequestId) {
            return;
        }

        const content = document.createDocumentFragment();
        addInfoRow(content, 'Назва країни', country.name);
        addInfoRow(content, 'Столиця', country.capital  'Не вказано');
        addInfoRow(
            content,
            population ? Населення (${population.year}) : 'Населення',
            population ? population.value.toLocaleString('uk-UA') : 'Дані недоступні'
        );
        addInfoRow(content, 'Регіон', region);
        addInfoRow(content, 'Валюта', country.currency  'Не вказано');
        addInfoRow(content, 'Код ISO', `${country.iso2  '—'} / ${country.iso3}`);

        if (country.flag) {
            const flag = document.createElement('img');
            flag.className = 'flag';
            flag.src = country.flag;
            flag.alt = Прапор країни ${country.name};
            content.appendChild(flag);
        }

        infoContainer.replaceChildren(content);
    } catch (error) {
        console.error('Помилка завантаження даних про країну:', error);
        if (requestId === countryRequestId) {
            infoContainer.textContent =
                Не вдалося завантажити дані про ${country.name}: ${error.message}.  +
                'Спробуйте ще раз пізніше.';
        }
    }
}

selectElement.addEventListener('change', event => {
    showCountry(event.target.value);
});

loadCountries();