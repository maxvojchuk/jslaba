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