/* ==========================================================================
   FIFA LIVE TRACKER - REALTIME ENGINE (ESPN API WITH DEMO SIM BACKUP)
   ========================================================================== */

// Global state variables
let isDemoMode = false;
let realMatches = []; // Loaded from API
let demoMatches = []; // Used when user triggers Demo Sim Mode
let featuredMatchId = null;
let activeTab = "stats";
let pollIntervalId = null;
let clockIntervalId = null;
let demoSimIntervalId = null;

// UI References
const currentTimeEl = document.getElementById("current-time");
const liveMatchesListEl = document.getElementById("live-matches-list");
const liveMatchesCountEl = document.getElementById("live-matches-count");
const apiStatusBadge = document.getElementById("api-status-badge");
const apiStatusText = document.getElementById("api-status-text");

// Featured Match Elements
const featuredLeagueEl = document.getElementById("featured-league");
const featuredMatchTimeEl = document.getElementById("featured-match-time");
const featuredHomeNameEl = document.getElementById("featured-home-name");
const featuredAwayNameEl = document.getElementById("featured-away-name");
const featuredHomeScoreEl = document.getElementById("featured-home-score");
const featuredAwayScoreEl = document.getElementById("featured-away-score");
const featuredHomeLogoContainer = document.getElementById("featured-home-logo-container");
const featuredAwayLogoContainer = document.getElementById("featured-away-logo-container");
const latestEventTickerEl = document.getElementById("latest-event-ticker");

// Stats Elements
const statHomePossessionEl = document.getElementById("stat-home-possession");
const statAwayPossessionEl = document.getElementById("stat-away-possession");
const barHomePossessionEl = document.getElementById("bar-home-possession");
const barAwayPossessionEl = document.getElementById("bar-away-possession");

const statHomeShotsEl = document.getElementById("stat-home-shots");
const statAwayShotsEl = document.getElementById("stat-away-shots");
const barHomeShotsEl = document.getElementById("bar-home-shots");
const barAwayShotsEl = document.getElementById("bar-away-shots");

const statHomeFoulsEl = document.getElementById("stat-home-fouls");
const statAwayFoulsEl = document.getElementById("stat-away-fouls");
const barHomeFoulsEl = document.getElementById("bar-home-fouls");
const barAwayFoulsEl = document.getElementById("bar-away-fouls");

// Lineups / Leaders Tab Elements
const matchTimelineEl = document.getElementById("match-timeline");
const featuredHomeLineupEl = document.getElementById("featured-home-lineup");
const featuredAwayLineupEl = document.getElementById("featured-away-lineup");

// Simulation Mode Toggle Elements
const btnToggleDemoMode = document.getElementById("btn-toggle-demo-mode");
const modeStatusBadge = document.getElementById("mode-status-badge");
const modeDescription = document.getElementById("mode-description");
const demoControls = document.getElementById("demo-controls");

// 1. Clock manager (updates local time in top bar)
function startClock() {
    function updateClock() {
        const now = new Date();
        currentTimeEl.textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    updateClock();
    clockIntervalId = setInterval(updateClock, 1000);
}

// 2. Fetch data from ESPN Scoreboard API (using CORS proxy fallback)
async function fetchRealTimeScores() {
    const primaryUrl = "https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard";
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(primaryUrl)}`;

    try {
        if (!isDemoMode) {
            updateApiStatus("CONECTANDO A ESPN...", "pulse-dot");
        }
        
        let response;
        try {
            // Attempt primary fetch direct
            response = await fetch(primaryUrl);
        } catch (e) {
            console.warn("Direct fetch blocked by CORS/network. Trying AllOrigins proxy...");
            // Failover to raw CORS proxy
            response = await fetch(proxyUrl);
        }

        if (!response.ok) throw new Error("API Scoreboard failure");

        const data = await response.json();
        
        // Parse ESPN matches structure to our internal app layout
        parseEspnData(data);

        if (!isDemoMode) {
            updateApiStatus("CONECTADO A ESPN API", "pulse-dot");
            renderDashboard();
        }
    } catch (err) {
        console.error("API error:", err);
        if (!isDemoMode) {
            updateApiStatus("API OFFLINE / FALLBACK", "pulse-dot api-error");
            // If API fails completely and we have no matches, load initial demo data automatically
            if (realMatches.length === 0) {
                console.warn("No real data available. Auto-switching to simulated environment...");
                activateDemoMode();
            }
        }
    }
}

// Update the top-right live status indicator
function updateApiStatus(text, badgeClass) {
    apiStatusText.textContent = text;
    apiStatusBadge.className = `live-pulse-container ${badgeClass}`;
}

// 3. Parser: Map ESPN JSON to Unified Match Array
function parseEspnData(data) {
    if (!data.events || data.events.length === 0) {
        realMatches = [];
        return;
    }

    realMatches = data.events.map(event => {
        const comp = event.competitions[0];
        const competitors = comp.competitors;
        
        const homeComp = competitors.find(c => c.homeAway === "home");
        const awayComp = competitors.find(c => c.homeAway === "away");

        // Parse State: 'pre' (scheduled), 'in' (live), 'post' (finished)
        const state = comp.status.type.state;
        let matchStatus = "scheduled";
        if (state === "in") matchStatus = "live";
        else if (state === "post") matchStatus = "ft";

        // Parse minute
        let matchMinute = 0;
        if (matchStatus === "live") {
            // clock is returned in seconds, convert to minutes
            matchMinute = Math.floor(comp.status.clock / 60) || parseInt(comp.status.displayClock) || 1;
        }

        // Parse Timeline Events
        let matchTimeline = [];
        if (comp.details && comp.details.length > 0) {
            matchTimeline = comp.details.map(detail => {
                const clockVal = detail.clock?.displayValue || `${Math.floor(detail.clock?.value / 60)}'`;
                const athlete = detail.athletesInvolved && detail.athletesInvolved[0];
                const playerName = athlete ? athlete.displayName : "Jugador";
                
                let evType = "shot";
                let evTitle = "Suceso";
                let evDesc = `${playerName} participó en la jugada.`;

                const isHomeDetail = detail.team?.id === homeComp.team?.id;
                const sideText = isHomeDetail ? "home" : "away";

                if (detail.type?.text === "Goal") {
                    evType = `goal-${sideText}`;
                    evTitle = `¡Gol de ${isHomeDetail ? homeComp.team.displayName : awayComp.team.displayName}!`;
                    evDesc = `${playerName} anota con calidad. (${clockVal})`;
                } else if (detail.yellowCard) {
                    evType = "card-y";
                    evTitle = "Tarjeta Amarilla 🟡";
                    evDesc = `${playerName} es amonestado. (${clockVal})`;
                } else if (detail.redCard) {
                    evType = "card-r";
                    evTitle = "Tarjeta Roja 🔴";
                    evDesc = `${playerName} es expulsado del campo. (${clockVal})`;
                }

                return {
                    minute: parseInt(clockVal) || 0,
                    team: sideText,
                    type: evType,
                    title: evTitle,
                    desc: evDesc
                };
            }).sort((a, b) => a.minute - b.minute);
        }

        // Parse Statistics
        const stats = {
            possession: [50, 50],
            shots: [0, 0],
            fouls: [0, 0]
        };

        const homeStats = homeComp.statistics;
        const awayStats = awayComp.statistics;

        if (homeStats && awayStats) {
            const hPoss = homeStats.find(s => s.name === "possessionPct");
            const aPoss = awayStats.find(s => s.name === "possessionPct");
            if (hPoss && aPoss) {
                stats.possession = [parseFloat(hPoss.displayValue), parseFloat(aPoss.displayValue)];
            }

            const hShots = homeStats.find(s => s.name === "totalShots");
            const aShots = awayStats.find(s => s.name === "totalShots");
            if (hShots && aShots) {
                stats.shots = [parseInt(hShots.displayValue), parseInt(aShots.displayValue)];
            }

            const hFouls = homeStats.find(s => s.name === "foulsCommitted");
            const aFouls = awayStats.find(s => s.name === "foulsCommitted");
            if (hFouls && aFouls) {
                stats.fouls = [parseInt(hFouls.displayValue), parseInt(aFouls.displayValue)];
            }
        }

        // Leaders list
        const homeLeaders = getLeadersList(homeComp.leaders);
        const awayLeaders = getLeadersList(awayComp.leaders);

        return {
            id: event.id,
            league: comp.altGameNote || event.season?.slug?.toUpperCase() || "FÚTBOL INTERNACIONAL",
            homeTeam: {
                name: homeComp.team.displayName,
                code: homeComp.team.abbreviation || homeComp.team.displayName.substring(0,3).toUpperCase(),
                logo: homeComp.team.logo
            },
            awayTeam: {
                name: awayComp.team.displayName,
                code: awayComp.team.abbreviation || awayComp.team.displayName.substring(0,3).toUpperCase(),
                logo: awayComp.team.logo
            },
            homeScore: parseInt(homeComp.score) || 0,
            awayScore: parseInt(awayComp.score) || 0,
            status: matchStatus,
            minute: matchMinute,
            statusText: comp.status.type.shortDetail || comp.status.type.detail || "",
            timeline: matchTimeline,
            stats: stats,
            leaders: {
                home: homeLeaders,
                away: awayLeaders
            }
        };
    });

    // Set active featuredMatchId automatically if empty or invalid
    const activeMatchesList = isDemoMode ? demoMatches : realMatches;
    if (activeMatchesList.length > 0) {
        const found = activeMatchesList.find(m => m.id === featuredMatchId);
        if (!found) {
            // Try to find the first live match
            const liveMatch = activeMatchesList.find(m => m.status === "live");
            featuredMatchId = liveMatch ? liveMatch.id : activeMatchesList[0].id;
        }
    }
}

// Helpers to get team leaders (scorers) from ESPN feed
function getLeadersList(leadersArr) {
    if (!leadersArr || leadersArr.length === 0) return [];
    
    // Find goals leader if possible
    const goalLeaderGroup = leadersArr.find(l => l.name === "goals" || l.name === "goalsLeaders");
    if (!goalLeaderGroup || !goalLeaderGroup.leaders) return [];

    return goalLeaderGroup.leaders.map(l => {
        return {
            name: l.athlete?.displayName || "Jugador",
            value: l.displayValue || ""
        };
    });
}

// 4. Render Core Dashboard
function renderDashboard() {
    const activeMatchesList = isDemoMode ? demoMatches : realMatches;

    // Sidebar: list of matches
    renderMatchesList(activeMatchesList);

    // Main Featured view
    renderFeaturedMatch(activeMatchesList);
}

// Render Sidebar List
function renderMatchesList(matchesArray) {
    if (matchesArray.length === 0) {
        liveMatchesListEl.innerHTML = `
            <div class="loading-spinner-container">
                <i data-lucide="calendar" style="width: 32px; height: 32px; color: var(--muted-text)"></i>
                <p>No hay partidos reales registrados para hoy en ESPN.</p>
            </div>
        `;
        liveMatchesCountEl.textContent = "0 en vivo";
        lucide.createIcons();
        return;
    }

    liveMatchesListEl.innerHTML = "";
    let liveCount = 0;

    matchesArray.forEach(match => {
        if (match.status === "live") liveCount++;

        const isActive = match.id === featuredMatchId ? "active" : "";
        const scoreString = match.status === "scheduled" ? "- : -" : `${match.homeScore} : ${match.awayScore}`;
        
        let statusBadgeText = "";
        let timeBadgeClass = "match-item-time";
        
        if (match.status === "live") {
            statusBadgeText = `VIVO ${match.minute}'`;
        } else if (match.status === "ft") {
            statusBadgeText = "TERMINADO";
            timeBadgeClass += " ft";
        } else {
            statusBadgeText = match.statusText || "PROGRAMADO";
            timeBadgeClass += " ft";
        }

        const matchItem = document.createElement("div");
        matchItem.className = `match-item ${isActive}`;
        matchItem.innerHTML = `
            <div class="match-item-teams">
                <div class="match-item-team">
                    ${match.homeTeam.logo ? `<img src="${match.homeTeam.logo}" class="mini-team-logo" alt="">` : `<span class="team-mini-dot" style="background-color: var(--muted-text)"></span>`}
                    <span>${match.homeTeam.name}</span>
                </div>
                <div class="match-item-team">
                    ${match.awayTeam.logo ? `<img src="${match.awayTeam.logo}" class="mini-team-logo" alt="">` : `<span class="team-mini-dot" style="background-color: var(--muted-text)"></span>`}
                    <span>${match.awayTeam.name}</span>
                </div>
            </div>
            <div class="match-item-meta">
                <span class="${timeBadgeClass}">${statusBadgeText}</span>
                <span class="match-item-league">${match.league}</span>
            </div>
            <div class="match-item-scores">
                <div>${match.status === "scheduled" ? "-" : match.homeScore}</div>
                <div>${match.status === "scheduled" ? "-" : match.awayScore}</div>
            </div>
        `;

        matchItem.addEventListener("click", () => {
            featuredMatchId = match.id;
            renderDashboard();
        });

        liveMatchesListEl.appendChild(matchItem);
    });

    liveMatchesCountEl.textContent = `${liveCount} en vivo`;
}

// Render Featured Match panel
function renderFeaturedMatch(matchesArray) {
    const match = matchesArray.find(m => m.id === featuredMatchId);
    if (!match) {
        // Clear panel or display empty message
        featuredHomeNameEl.textContent = "Selecciona un partido";
        featuredAwayNameEl.textContent = "";
        featuredHomeScoreEl.textContent = "-";
        featuredAwayScoreEl.textContent = "-";
        featuredHomeLogoContainer.innerHTML = `<div class="logo-placeholder"></div>`;
        featuredAwayLogoContainer.innerHTML = `<div class="logo-placeholder"></div>`;
        featuredLeagueEl.textContent = "PARTIDOS DE HOY";
        featuredMatchTimeEl.textContent = "--";
        latestEventTickerEl.innerHTML = `<span class="event-text">Selecciona un encuentro en la barra lateral para ver su desglose en tiempo real.</span>`;
        return;
    }

    // Header info
    featuredLeagueEl.textContent = match.league;
    
    if (match.status === "live") {
        featuredMatchTimeEl.textContent = `VIVO ${match.minute}'`;
        featuredMatchTimeEl.style.backgroundColor = "var(--live-red)";
    } else if (match.status === "ft") {
        featuredMatchTimeEl.textContent = "FINALIZADO";
        featuredMatchTimeEl.style.backgroundColor = "var(--muted-text)";
    } else {
        featuredMatchTimeEl.textContent = match.statusText || "PROGRAMADO";
        featuredMatchTimeEl.style.backgroundColor = "var(--border-color-hover)";
    }

    // Team names & score numbers
    featuredHomeNameEl.textContent = match.homeTeam.name;
    featuredAwayNameEl.textContent = match.awayTeam.name;
    featuredHomeScoreEl.textContent = match.status === "scheduled" ? "-" : match.homeScore;
    featuredAwayScoreEl.textContent = match.status === "scheduled" ? "-" : match.awayScore;

    // Team Logos
    if (match.homeTeam.logo) {
        featuredHomeLogoContainer.innerHTML = `<img src="${match.homeTeam.logo}" class="team-logo" alt="${match.homeTeam.name}">`;
    } else {
        featuredHomeLogoContainer.innerHTML = `<div class="flag-gradient generic-flag"></div><span class="flag-text">${match.homeTeam.code}</span>`;
    }

    if (match.awayTeam.logo) {
        featuredAwayLogoContainer.innerHTML = `<img src="${match.awayTeam.logo}" class="team-logo" alt="${match.awayTeam.name}">`;
    } else {
        featuredAwayLogoContainer.innerHTML = `<div class="flag-gradient generic-flag"></div><span class="flag-text">${match.awayTeam.code}</span>`;
    }

    // Update Ticker
    if (match.timeline.length > 0) {
        const lastEv = match.timeline[match.timeline.length - 1];
        let eventIcon = "zap";
        let iconClass = "goal-color";

        if (lastEv.type.startsWith("goal")) {
            eventIcon = "goal";
            iconClass = "goal-color";
        } else if (lastEv.type === "card-y") {
            eventIcon = "alert-triangle";
            iconClass = "card-yellow";
        } else if (lastEv.type === "card-r") {
            eventIcon = "alert-octagon";
            iconClass = "card-red";
        }

        latestEventTickerEl.innerHTML = `
            <i data-lucide="${eventIcon}" class="event-icon ${iconClass}"></i>
            <span class="event-text">${lastEv.minute}' ${lastEv.title} ${lastEv.desc}</span>
        `;
    } else {
        latestEventTickerEl.innerHTML = `
            <i data-lucide="play" class="event-icon text-muted"></i>
            <span class="event-text">Sin incidencias de juego registradas para este partido.</span>
        `;
    }

    // Update Stats Bars
    statHomePossessionEl.textContent = `${match.stats.possession[0]}%`;
    statAwayPossessionEl.textContent = `${match.stats.possession[1]}%`;
    barHomePossessionEl.style.width = `${match.stats.possession[0]}%`;
    barAwayPossessionEl.style.width = `${match.stats.possession[1]}%`;

    statHomeShotsEl.textContent = match.stats.shots[0];
    statAwayShotsEl.textContent = match.stats.shots[1];
    const totalShots = (match.stats.shots[0] + match.stats.shots[1]) || 1;
    barHomeShotsEl.style.width = `${(match.stats.shots[0] / totalShots) * 100}%`;
    barAwayShotsEl.style.width = `${(match.stats.shots[1] / totalShots) * 100}%`;

    statHomeFoulsEl.textContent = match.stats.fouls[0];
    statAwayFoulsEl.textContent = match.stats.fouls[1];
    const totalFouls = (match.stats.fouls[0] + match.stats.fouls[1]) || 1;
    barHomeFoulsEl.style.width = `${(match.stats.fouls[0] / totalFouls) * 100}%`;
    barAwayFoulsEl.style.width = `${(match.stats.fouls[1] / totalFouls) * 100}%`;

    // Render Timeline
    matchTimelineEl.innerHTML = "";
    if (match.timeline.length === 0) {
        matchTimelineEl.innerHTML = `<div class="event-desc">Esperando incidencias o eventos en vivo desde la API.</div>`;
    } else {
        [...match.timeline].reverse().forEach(ev => {
            const evDiv = document.createElement("div");
            
            let extraClass = "";
            let lucideIcon = "zap";
            if (ev.type === "goal-home") {
                extraClass = "event-home";
                lucideIcon = "goal";
            } else if (ev.type === "goal-away") {
                extraClass = "event-away";
                lucideIcon = "goal";
            } else if (ev.type === "card-y") {
                extraClass = "event-card-y";
                lucideIcon = "alert-triangle";
            } else if (ev.type === "card-r") {
                extraClass = "event-card-r";
                lucideIcon = "alert-octagon";
            }

            evDiv.className = `timeline-event ${extraClass}`;
            evDiv.innerHTML = `
                <span class="event-time">${ev.minute}'</span>
                <div class="event-details">
                    <span class="event-title">${ev.title}</span>
                    <span class="event-desc">${ev.desc}</span>
                </div>
            `;
            matchTimelineEl.appendChild(evDiv);
        });
    }

    // Render Lineups / Leaders Tab
    featuredHomeLineupEl.innerHTML = "";
    featuredAwayLineupEl.innerHTML = "";

    const hLeaders = match.leaders?.home || [];
    const aLeaders = match.leaders?.away || [];

    if (hLeaders.length === 0 && aLeaders.length === 0) {
        // Show placeholders or generated squad if it's demo mode
        if (isDemoMode) {
            renderDemoLineups(match);
        } else {
            featuredHomeLineupEl.innerHTML = `<li><span class="player-name text-muted">Alineación no disponible para este partido.</span></li>`;
            featuredAwayLineupEl.innerHTML = `<li><span class="player-name text-muted">Alineación no disponible para este partido.</span></li>`;
        }
    } else {
        // Render real-world leaders (Top scorers)
        document.getElementById("home-lineup-title").textContent = "Goleadores del Torneo";
        document.getElementById("away-lineup-title").textContent = "Goleadores del Torneo";

        hLeaders.forEach(leader => {
            const li = document.createElement("li");
            li.innerHTML = `<span class="player-name">${leader.name}</span> <span class="leader-val">${leader.value} Goles</span>`;
            featuredHomeLineupEl.appendChild(li);
        });

        aLeaders.forEach(leader => {
            const li = document.createElement("li");
            li.innerHTML = `<span class="player-name">${leader.name}</span> <span class="leader-val">${leader.value} Goles</span>`;
            featuredAwayLineupEl.appendChild(li);
        });
    }

    lucide.createIcons();
}

function renderDemoLineups(match) {
    document.getElementById("home-lineup-title").textContent = "Plantilla Titular";
    document.getElementById("away-lineup-title").textContent = "Plantilla Titular";

    const demoSquadHome = [
        "Lionel Messi", "Julián Álvarez", "Ángel Di María", 
        "Rodrigo De Paul", "Enzo Fernández", "Alexis Mac Allister",
        "Nahuel Molina", "Cristian Romero", "Nicolás Otamendi", "Marcos Acuña", "Dibu Martínez"
    ];
    const demoSquadAway = [
        "Kylian Mbappé", "Olivier Giroud", "Antoine Griezmann",
        "Ousmane Dembélé", "Adrien Rabiot", "Aurélien Tchouaméni",
        "Jules Koundé", "Raphaël Varane", "Dayot Upamecano", "Theo Hernandez", "Hugo Lloris"
    ];

    demoSquadHome.forEach((name, i) => {
        const li = document.createElement("li");
        li.innerHTML = `<span class="leader-val">${i===10 ? 'PO' : 'DF'}</span> <span class="player-name">${name}</span>`;
        featuredHomeLineupEl.appendChild(li);
    });

    demoSquadAway.forEach((name, i) => {
        const li = document.createElement("li");
        li.innerHTML = `<span class="leader-val">${i===10 ? 'PO' : 'DF'}</span> <span class="player-name">${name}</span>`;
        featuredAwayLineupEl.appendChild(li);
    });
}

// 5. Setup tab listeners
function setupTabListeners() {
    const tabs = document.querySelectorAll(".tab-btn");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

            tab.classList.add("active");
            activeTab = tab.getAttribute("data-tab");
            document.getElementById(`tab-${activeTab}`).classList.add("active");
        });
    });
}

// 6. Toggle: Real Live Mode vs Demo Simulation Environment
function setupModeToggler() {
    btnToggleDemoMode.addEventListener("click", () => {
        if (!isDemoMode) {
            activateDemoMode();
        } else {
            activateRealMode();
        }
    });
}

function activateDemoMode() {
    isDemoMode = true;
    
    // Update labels and indicators
    btnToggleDemoMode.innerHTML = `<i data-lucide="radio"></i> Conectar a Partidos Reales (ESPN)`;
    modeStatusBadge.textContent = "Modo Demo Simulado";
    modeStatusBadge.className = "control-status demo-active";
    modeDescription.textContent = "Ejecutando un partido virtual de simulación local. Puedes usar la Consola de Control de abajo para forzar jugadas.";
    demoControls.classList.remove("disabled-controls");
    
    updateApiStatus("SIMULADOR INTERNO ACTIVO", "pulse-dot");

    // Load initial demo matches data (Argentina vs Francia replica)
    demoMatches = [
        {
            id: "demo-1",
            league: "PARTIDO DE EXHIBICIÓN",
            homeTeam: {
                name: "Argentina",
                code: "ARG",
                logo: "https://a.espncdn.com/i/teamlogos/countries/500/arg.png"
            },
            awayTeam: {
                name: "Francia",
                code: "FRA",
                logo: "https://a.espncdn.com/i/teamlogos/countries/500/fra.png"
            },
            homeScore: 2,
            awayScore: 1,
            status: "live",
            minute: 76,
            timeline: [
                { minute: 23, team: "home", type: "goal-home", title: "¡Gol de Argentina!", desc: "Lionel Messi de penal. (1 - 0)" },
                { minute: 36, team: "home", type: "goal-home", title: "¡Gol de Argentina!", desc: "Ángel Di María define cruzado. (2 - 0)" },
                { minute: 72, team: "away", type: "goal-away", title: "¡Gol de Francia!", desc: "Kylian Mbappé remate cruzado. (2 - 1)" }
            ],
            stats: {
                possession: [52, 48],
                shots: [11, 8],
                fouls: [9, 12]
            }
        }
    ];

    featuredMatchId = "demo-1";
    renderDashboard();

    // Start local ticking interval (every 6 seconds represents 1 minute virtual match time)
    if (demoSimIntervalId) clearInterval(demoSimIntervalId);
    demoSimIntervalId = setInterval(tickDemoSimulation, 6000);

    lucide.createIcons();
}

function activateRealMode() {
    isDemoMode = false;
    
    // Clear demo ticker
    if (demoSimIntervalId) {
        clearInterval(demoSimIntervalId);
        demoSimIntervalId = null;
    }

    btnToggleDemoMode.innerHTML = `<i data-lucide="zap"></i> Cambiar a Modo Simulación Demo`;
    modeStatusBadge.textContent = "Modo Real";
    modeStatusBadge.className = "control-status";
    modeDescription.textContent = "Viendo partidos de fútbol del mundo real actualizados en vivo de ESPN.";
    demoControls.classList.add("disabled-controls");

    // Fetch and redraw
    fetchRealTimeScores();
}

// 7. Demo mode simulation simulation ticking loop
function tickDemoSimulation() {
    if (!isDemoMode) return;

    demoMatches.forEach(match => {
        if (match.status !== "live") return;
        
        match.minute += 1;
        if (match.minute >= 90) {
            match.status = "ft";
            match.timeline.push({
                minute: 90,
                team: "system",
                type: "ft",
                title: "Fin del Partido",
                desc: `Final de los 90 minutos reglamentarios.`
            });
        } else {
            // Drift stats
            let diff = Math.floor(Math.random() * 3) - 1;
            let currentHome = match.stats.possession[0];
            let newHome = Math.max(35, Math.min(65, currentHome + diff));
            match.stats.possession = [newHome, 100 - newHome];

            // 5% chance of goal or card
            if (Math.random() < 0.05) {
                simulateDemoMatchEvent(match);
            }
        }
    });

    renderDashboard();
}

function simulateDemoMatchEvent(match) {
    const isHome = Math.random() > 0.5;
    const side = isHome ? "home" : "away";
    const scoringTeam = isHome ? match.homeTeam : match.awayTeam;
    
    const eventRoll = Math.random();

    if (eventRoll < 0.3) {
        // Goal
        if (isHome) {
            match.homeScore++;
            featuredHomeScoreEl.classList.add("score-flash");
            setTimeout(() => featuredHomeScoreEl.classList.remove("score-flash"), 1500);
        } else {
            match.awayScore++;
            featuredAwayScoreEl.classList.add("score-flash");
            setTimeout(() => featuredAwayScoreEl.classList.remove("score-flash"), 1500);
        }
        match.timeline.push({
            minute: match.minute,
            team: side,
            type: `goal-${side}`,
            title: `¡Gol de ${scoringTeam.name}!`,
            desc: `Remate con fuerza al fondo de la red. (${match.minute}')`
        });
        match.stats.shots[isHome ? 0 : 1] += 1;
    } else {
        // Card
        match.timeline.push({
            minute: match.minute,
            team: side,
            type: "card-y",
            title: "Tarjeta Amarilla 🟡",
            desc: `Falta táctica por parte de ${scoringTeam.name}. (${match.minute}')`
        });
        match.stats.fouls[isHome ? 0 : 1] += 1;
    }
}

// 8. Console control listeners (Demo manual forces)
function setupSimulatorListeners() {
    document.getElementById("btn-force-goal-home").addEventListener("click", () => {
        if (!isDemoMode) return;
        forceDemoGoal("home");
    });
    document.getElementById("btn-force-goal-away").addEventListener("click", () => {
        if (!isDemoMode) return;
        forceDemoGoal("away");
    });
    document.getElementById("btn-force-card-home").addEventListener("click", () => {
        if (!isDemoMode) return;
        forceDemoCard("home");
    });
    document.getElementById("btn-force-card-away").addEventListener("click", () => {
        if (!isDemoMode) return;
        forceDemoCard("away");
    });
    document.getElementById("btn-trigger-event").addEventListener("click", () => {
        if (!isDemoMode) return;
        const match = demoMatches.find(m => m.id === featuredMatchId);
        if (match) {
            simulateDemoMatchEvent(match);
            renderDashboard();
        }
    });
}

function forceDemoGoal(side) {
    const match = demoMatches.find(m => m.id === featuredMatchId);
    if (!match || match.status !== "live") return;

    const scoringTeam = side === "home" ? match.homeTeam : match.awayTeam;

    if (side === "home") {
        match.homeScore++;
        featuredHomeScoreEl.classList.add("score-flash");
        setTimeout(() => featuredHomeScoreEl.classList.remove("score-flash"), 1500);
    } else {
        match.awayScore++;
        featuredAwayScoreEl.classList.add("score-flash");
        setTimeout(() => featuredAwayScoreEl.classList.remove("score-flash"), 1500);
    }

    match.timeline.push({
        minute: match.minute,
        team: side,
        type: `goal-${side}`,
        title: `¡Gol de ${scoringTeam.name}!`,
        desc: `Forzado desde la Consola. (${match.minute}')`
    });

    match.stats.shots[side === "home" ? 0 : 1] += 1;
    renderDashboard();
}

function forceDemoCard(side) {
    const match = demoMatches.find(m => m.id === featuredMatchId);
    if (!match || match.status !== "live") return;

    const targetedTeam = side === "home" ? match.homeTeam : match.awayTeam;

    match.timeline.push({
        minute: match.minute,
        team: side,
        type: "card-y",
        title: "Tarjeta Amarilla 🟡",
        desc: `Falta de advertencia del jugador de ${targetedTeam.name}. (${match.minute}')`
    });

    match.stats.fouls[side === "home" ? 0 : 1] += 1;
    renderDashboard();
}

// Initialize application on load
window.addEventListener("DOMContentLoaded", () => {
    startClock();
    setupTabListeners();
    setupModeToggler();
    setupSimulatorListeners();

    // Load real-time scores immediately
    fetchRealTimeScores();
    
    // Poll real scores every 20 seconds
    pollIntervalId = setInterval(fetchRealTimeScores, 20000);
});
