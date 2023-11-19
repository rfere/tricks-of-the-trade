// ==UserScript==
// @name         Tricks of the Trade
// @version      0.1.0
// @grant        none
// @author       Raul
// @license      GPL-3.0-or-later
// @description  Assign Tricks of the Trade damage to the rogue who cast it on Warcraft Logs
// @match        *://*.warcraftlogs.com/reports/*
// @namespace    https://github.com/rfere/tricks-of-the-trade
// @supportURL   https://github.com/rfere/tricks-of-the-trade
// @icon         https://wow.zamimg.com/images/wow/icons/large/ability_rogue_tricksofthetrade.jpg
// ==/UserScript==

(function() {
    'use strict';

    const tricksRegexp = /.+ \((.+)\)/
    const locale = window.location.hostname.match(/([a-z]+).classic.+/)?.[1] || 'en';

    const localeMap = {
        'en': {
            'millions': 'm',
            'thousands': 'k'
        },
        'de': {
            'millions': 'Mio',
            'thousands': 't'
        },
        'fr': {
            'millions': 'kk',
            'thousands': 'k'
        },
        'it': {
            'millions': 'mln',
            'thousands': 'k'
        },
        'ru': {
            'millions': 'млн',
            'thousands': 'тыс'
        },
        'ko': {
            'millions': 'M',
            'thousands': 'K'
        },
        'tw': {
            'millions': '百萬',
            'thousands': '千'
        },
        'cn': {
            'millions': '百万',
            'thousands': '千'
        },
        get es() {
            return this.en;
        },
        get br() {
            return this.en;
        },
    };

    const parseNumber = (num) => {
        const millions = localeMap[locale].millions;
        const thousands = localeMap[locale].thousands;
        return num.endsWith(millions) ? num.replace(millions, '') * 1000000
            : (num.endsWith(thousands) ? num.replace(thousands, '') * 1000 : parseFloat(num.replace(',', '')))
    }

    const parseDuration = (duration) => {
        const parts = duration.match(/(\d+):(\d+)/);
        return (parts[1] * 60) + +parts[2];
    };

    const localizeTotal = (damage) => {
        const currentLocale = localeMap[locale];
        const fractionDigits = damage >= 1000000 ? 2 : (damage >= 1000 ? 1 : 0);
        return new Intl.NumberFormat('en-US', {
            notation: 'compact',
            compactDisplay: 'short',
            maximumFractionDigits: fractionDigits,
            minimumFractionDigits: fractionDigits
        }).format(damage).replace('M', currentLocale.millions).replace('K', currentLocale.thousands);
    };

    const createPetBar = (width, tooltipId) => {
        const petBar = document.createElement('div');
        petBar.classList.add('Pet-bg');
        petBar.style['border-left'] = '1px solid black';
        petBar.style['min-width'] = '2px';
        petBar.style.position = 'absolute';
        petBar.style.right = '0px';
        petBar.style.top = '0px';
        petBar.style.bottom = '0px';
        petBar.style.color = 'white';
        petBar.style['text-align'] = 'center';
        petBar.style.cursor = 'pointer';
        petBar.style.width = width;
        petBar.onclick = () => {
            window.location.href = `${window.location.href}&source=${tooltipId}`
        };
        return petBar;
    };

    const sortPlayersByDamage = (table, playerRows) => {
        let times = 0; let sorted = true;

        do {
            sorted = true;
            for (let i = 0; i < playerRows.length - 2; i++) {
                const a = playerRows[i];
                const b = playerRows[i + 1];
                const aDamage = parseNumber(a.querySelector('.main-per-second-amount').innerText);
                const bDamage = parseNumber(b.querySelector('.main-per-second-amount').innerText);
                if (aDamage < bDamage) {
                    sorted = false;
                    a.parentNode.insertBefore(b.parentNode.removeChild(b), a);
                    playerRows = table.querySelectorAll('tr.odd, tr.even');
                }
            }

            times++;
        } while (!sorted && times < 100);
    };

    const doJustice = () => {
        const table = document.querySelector('table.summary-table');
        const playerRows = table.querySelectorAll('tr.odd, tr.even');
        const fightDuration = parseDuration(document.querySelector('span.fight-duration').innerText);
        const topPlayerDamage = parseNumber(playerRows[0].querySelector('.report-amount-total').innerText);
        const totalEncounterDamage = parseNumber(table.querySelector('tr.totals span.report-amount-total').innerText);
        const tricksRows = Array.from(playerRows).filter(x => Array.from(x.getElementsByTagName('a')).filter(y => y.innerText.match(tricksRegexp)).length);
        let tricksters = [];

        tricksRows.forEach(tricksRow => {
            const anchor = tricksRow.querySelector('a.TricksOfTheTrade');
            const name = anchor.innerText.match(tricksRegexp)[1];
            let tricksDamage = tricksRow.querySelector('.report-amount-total').innerText;
            const tooltipId = anchor.oncontextmenu.toString().match(/setFilterSource\('(\d+)/)[1];
            tricksDamage = parseNumber(tricksDamage);
            tricksters.push({name, tricksDamage, tooltipId});
            tricksRow.remove();
        });

        tricksters.forEach(trickster => {
            const row = Array.from(playerRows).filter(x => Array.from(x.getElementsByTagName('a')).filter(y => y.innerText == trickster.name).length)[0];
            const totalDamageElement = row.querySelector('.report-amount-total');
            let totalDamage = parseNumber(totalDamageElement.innerText);
            totalDamage += trickster.tricksDamage;
            const percentDamageElement = row.querySelector('div.report-amount-percent');
            let percentDamage = parseNumber(percentDamageElement.innerText);
            percentDamage = (totalDamage / totalEncounterDamage * 100).toFixed(2) + '%';
            const dpsElement = row.querySelector('.main-per-second-amount');
            let dps = parseNumber(dpsElement.innerText);
            dps = (totalDamage / fightDuration).toFixed(1);
            dpsElement.innerText = (+dps).toLocaleString();
            percentDamageElement.innerText = percentDamage;
            totalDamageElement.innerText = localizeTotal(totalDamage);
            const damageBarElement = row.querySelector('div.Rogue-bg');
            damageBarElement.style.width = (totalDamage / topPlayerDamage * 100) + '%';
            const petBar = createPetBar((trickster.tricksDamage / totalDamage * 100) + '%', trickster.tooltipId);
            const tooltip = Array.from(document.getElementsByTagName('div')).filter(x => x.id.includes(`popup-tooltip-${trickster.tooltipId}`))[0];
            createTipped(petBar, tooltip);
            damageBarElement.children[0].appendChild(petBar);
        });

        sortPlayersByDamage(table, table.querySelectorAll('tr.odd, tr.even'));
    };

    (new MutationObserver((changes, observer) => {
        if (document.querySelector('div#table-container table.summary-table tr.totals')) {
            doJustice();
        }
    })).observe(document.querySelector('div#table-container'), {
        childList: true,
        subtree: true
    });
})();