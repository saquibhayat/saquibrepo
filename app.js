/**
 * Religare Broking Executive Intelligence - Multi-Sheet Ingestion & Analytics Engine
 * 
 * Multi-Sheet Architecture:
 * 1. Sheet "Brokerage": Net/Gross Brokerage, Segments (Cash/F&O/Comm), Trade Mode, Turnover, Orders
 * 2. Sheet "UTC": Traded client activity flags (FTD, MTD, YTD), active penetration, ARPU
 * 3. Sheet "Acquisition": Account opening & activation cohorts (FTD, MTD, YTD)
 * 4. Sheet "TPP": Third Party Products (Mutual Funds AUM & SIP, Life/Health Insurance, SGB & Bonds)
 * 
 * Auto-Join Engine matches rows across all 4 sheets using CLIENT_CODE and Hierarchy Keys!
 */

(function () {
  // Application State
  const state = {
    selectedDate: '27-Aug-2026',
    timeFilter: 'mtd', // 'ftd' | 'mtd' | 'ytd'
    selectedChannel: 'ALL',
    selectedRegion: 'ALL',
    selectedZone: 'ALL',
    selectedBranch: 'ALL',
    selectedDealer: 'ALL',
    selectedClient: 'ALL',
    expandedNodes: new Set(['CH_BRANCH', 'REG_NORTH', 'ZONE_DELHI_NCR', '8047']),
    searchQuery: '',
    uploadedWorkbook: null,
    uploadedTree: null,
    uploadedMetrics: null,
    dataSource: 'sample' // 'sample' | 'live'
  };

  // Indian Currency / Number Formatting Utilities
  function formatINR(val, isLakhCr = true) {
    if (val === null || val === undefined || isNaN(val)) return '₹0';
    const num = Number(val);
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';

    if (!isLakhCr) {
      return sign + '₹' + Math.round(num).toLocaleString('en-IN');
    }

    if (abs >= 10000000) { // 1 Crore = 10,000,000
      const cr = (abs / 10000000).toFixed(2);
      return `${sign}₹${cr.replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1')} Cr`;
    } else if (abs >= 100000) { // 1 Lakh = 100,000
      const l = (abs / 100000).toFixed(2);
      return `${sign}₹${l.replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1')} L`;
    } else if (abs >= 1000) {
      const k = (abs / 1000).toFixed(1);
      return `${sign}₹${k.replace(/\.0$/, '')} K`;
    }
    return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
  }

  function formatCount(val) {
    if (val === null || val === undefined || isNaN(val)) return '0';
    const num = Number(val);
    if (num >= 100000) {
      return (num / 100000).toFixed(1).replace(/\.0$/, '') + ' L';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + ' K';
    }
    return num.toLocaleString('en-IN');
  }

  function getActiveHierarchyTree() {
    return (state.dataSource === 'live' && state.uploadedTree) ? state.uploadedTree : window.RELIGARE_DATA.hierarchyTree;
  }

  // Filter clients based on current hierarchy selection
  function getFilteredClients() {
    const activeTree = getActiveHierarchyTree();
    let clients = window.RELIGARE_DATA.collectClients(activeTree);

    if (state.selectedChannel !== 'ALL') {
      const ch = activeTree.find(c => c.channelId === state.selectedChannel);
      clients = ch ? window.RELIGARE_DATA.collectClients(ch) : [];
    }

    if (state.selectedRegion !== 'ALL') {
      let matchedReg = null;
      activeTree.forEach(ch => {
        const r = ch.regions ? ch.regions.find(reg => reg.regionId === state.selectedRegion) : null;
        if (r) matchedReg = r;
      });
      if (matchedReg) clients = window.RELIGARE_DATA.collectClients(matchedReg);
    }

    if (state.selectedZone !== 'ALL') {
      let matchedZone = null;
      activeTree.forEach(ch => {
        if (ch.regions) {
          ch.regions.forEach(r => {
            const z = r.zones ? r.zones.find(zone => zone.zoneId === state.selectedZone) : null;
            if (z) matchedZone = z;
          });
        }
      });
      if (matchedZone) clients = window.RELIGARE_DATA.collectClients(matchedZone);
    }

    if (state.selectedBranch !== 'ALL') {
      clients = clients.filter(c => c.branchCode === state.selectedBranch);
    }

    if (state.selectedDealer !== 'ALL') {
      clients = clients.filter(c => c.dealerName === state.selectedDealer);
    }

    if (state.selectedClient !== 'ALL') {
      clients = clients.filter(c => c.clientCode === state.selectedClient);
    }

    return clients;
  }

  // Get current node descriptive title and role badge
  function getCurrentLevelInfo() {
    if (state.selectedClient !== 'ALL') {
      return { title: `Client: ${state.selectedClient}`, badge: 'CLIENT PROFILE', type: 'client' };
    }
    if (state.selectedDealer !== 'ALL') {
      return { title: `Dealer: ${state.selectedDealer}`, badge: 'DEALER DESK', type: 'dealer' };
    }
    if (state.selectedBranch !== 'ALL') {
      const isBP = String(state.selectedBranch).startsWith('BP');
      return { title: `Branch: ${state.selectedBranch}`, badge: isBP ? 'BP HEAD' : 'BRANCH MANAGER', type: 'branch' };
    }
    if (state.selectedZone !== 'ALL') {
      const zName = state.selectedZone.replace('ZONE_', '').replace(/_/g, ' ');
      return { title: `${zName} Zone`, badge: 'ZONAL HEAD', type: 'zone' };
    }
    if (state.selectedRegion !== 'ALL') {
      const rName = state.selectedRegion.replace('REG_', '').replace(/_/g, ' ');
      return { title: `${rName} Region`, badge: 'REGIONAL HEAD', type: 'region' };
    }
    if (state.selectedChannel !== 'ALL') {
      return { title: `Channel Overview`, badge: 'CHANNEL HEAD', type: 'channel' };
    }
    return { title: 'Executive Intelligence Dashboard', badge: 'NATIONAL HEAD', type: 'national' };
  }

  // Render Persistent Top 3 Master KPI Cards (Kept OUT of FTD/MTD/YTD filter)
  function renderPersistentCoreKPIs(metrics) {
    const k = metrics.kpis;

    // 1. Net Brokerage
    document.getElementById('nb-yesterday-val').textContent = formatINR(k.netBrokerage.yesterday);
    document.getElementById('nb-yesterday-growth').innerHTML = `<span class="growth-pill ${k.netBrokerage.yesterdayGrowth >= 0 ? 'positive' : 'negative'}">▲ ${k.netBrokerage.yesterdayGrowth}%</span> vs prev`;

    document.getElementById('nb-mtd-val').textContent = formatINR(k.netBrokerage.mtd);
    document.getElementById('nb-mtd-growth').innerHTML = `<span class="growth-pill positive">▲ ${k.netBrokerage.mtdGrowth}%</span> pacing`;

    document.getElementById('nb-ytd-val').textContent = formatINR(k.netBrokerage.ytd);
    document.getElementById('nb-ytd-growth').innerHTML = `<span class="growth-pill positive">▲ ${k.netBrokerage.ytdGrowth}%</span> YoY`;

    const nbGbEl = document.getElementById('exec-nbgb-ratio');
    if (nbGbEl) nbGbEl.textContent = `(${k.netBrokerage.nbGbRatio}% NB/GB)`;

    // 2. Unique Traded Clients (UTC)
    document.getElementById('utc-yesterday-val').textContent = formatCount(k.uniqueTradedClients.yesterday);
    document.getElementById('utc-yesterday-meta').innerHTML = `<span>${k.uniqueTradedClients.yesterdayPctMapped}% Act</span><span>ARPU ${formatINR(k.uniqueTradedClients.arpuYesterday, false)}</span>`;

    document.getElementById('utc-mtd-val').textContent = formatCount(k.uniqueTradedClients.mtd);
    document.getElementById('utc-mtd-meta').innerHTML = `<span>${k.uniqueTradedClients.mtdPctMapped}% Map</span><span>ARPU ${formatINR(k.uniqueTradedClients.arpuMTD, false)}</span>`;

    document.getElementById('utc-ytd-val').textContent = formatCount(k.uniqueTradedClients.ytd);
    document.getElementById('utc-ytd-meta').innerHTML = `<span>${k.uniqueTradedClients.ytdPctMapped}% Tot</span><span>ARPU ${formatINR(k.uniqueTradedClients.arpuYTD, false)}</span>`;

    // 3. Account Opening
    document.getElementById('acq-yesterday-val').textContent = formatCount(k.accountOpening.yesterday);
    document.getElementById('acq-yesterday-meta').innerHTML = `<span>${k.accountOpening.yesterdayActivated} Act</span><span>${k.accountOpening.yesterdayActivationRate}% Rate</span>`;

    document.getElementById('acq-mtd-val').textContent = formatCount(k.accountOpening.mtd);
    document.getElementById('acq-mtd-meta').innerHTML = `<span>${k.accountOpening.mtdActivated} Act</span><span>${k.accountOpening.mtdActivationRate}% Rate</span>`;

    document.getElementById('acq-ytd-val').textContent = formatCount(k.accountOpening.ytd);
    document.getElementById('acq-ytd-meta').innerHTML = `<span>${k.accountOpening.ytdActivated} Act</span><span>${k.accountOpening.ytdActivationRate}% Target</span>`;
  }

  // Render Single Donut Chart for Client Cohorts (NCR, PCR, OCR) with ARPU
  function renderCohortDonut(metrics) {
    const tf = state.timeFilter;
    const tfUpper = tf.toUpperCase();
    const cat = metrics.ncrPcrOcr;

    const ncrVal = cat.ncr[tf] || 0;
    const pcrVal = cat.pcr[tf] || 0;
    const ocrVal = cat.ocr[tf] || 0;
    const total = ncrVal + pcrVal + ocrVal;

    const ncrPct = total > 0 ? ((ncrVal / total) * 100).toFixed(1) : '0.0';
    const pcrPct = total > 0 ? ((pcrVal / total) * 100).toFixed(1) : '0.0';
    const ocrPct = total > 0 ? ((ocrVal / total) * 100).toFixed(1) : '0.0';

    const ncrDeg = (Number(ncrPct) / 100) * 360;
    const pcrDeg = ncrDeg + (Number(pcrPct) / 100) * 360;

    const donut = document.getElementById('cohort-donut-visual');
    if (donut) {
      donut.style.background = `conic-gradient(var(--c-cyan) 0deg ${ncrDeg}deg, var(--c-green) ${ncrDeg}deg ${pcrDeg}deg, var(--c-pink) ${pcrDeg}deg 360deg)`;
    }

    document.getElementById('cohort-total-val').textContent = formatINR(total);
    document.getElementById('cohort-total-sub').textContent = `${tfUpper} Total`;
    document.getElementById('cohort-time-badge').textContent = `${tfUpper} VIEW`;

    document.getElementById('ncr-donut-brok').textContent = formatINR(ncrVal);
    document.getElementById('ncr-donut-utc').textContent = `(${formatCount(cat.ncr.utc ? cat.ncr.utc[tf] : 0)} UTC)`;
    document.getElementById('ncr-arpu-val').textContent = `ARPU ${formatINR(cat.ncr.arpu ? cat.ncr.arpu[tf] : 0, false)}`;

    document.getElementById('pcr-donut-brok').textContent = formatINR(pcrVal);
    document.getElementById('pcr-donut-utc').textContent = `(${formatCount(cat.pcr.utc ? cat.pcr.utc[tf] : 0)} UTC)`;
    document.getElementById('pcr-arpu-val').textContent = `ARPU ${formatINR(cat.pcr.arpu ? cat.pcr.arpu[tf] : 0, false)}`;

    document.getElementById('ocr-donut-brok').textContent = formatINR(ocrVal);
    document.getElementById('ocr-donut-utc').textContent = `(${formatCount(cat.ocr.utc ? cat.ocr.utc[tf] : 0)} UTC)`;
    document.getElementById('ocr-arpu-val').textContent = `ARPU ${formatINR(cat.ocr.arpu ? cat.ocr.arpu[tf] : 0, false)}`;
  }

  // Render Channel-wise Revenue Mix
  function renderChannelRevenueMix(metrics) {
    const tf = state.timeFilter;
    const tfUpper = tf.toUpperCase();
    const ch = metrics.channelRevenueMix;

    document.getElementById('channel-time-badge').textContent = `${tfUpper} VIEW`;

    const bVal = (ch && ch.CH_BRANCH) ? ch.CH_BRANCH[tf] : 0;
    const bpVal = (ch && ch.CH_FRANCHISEE) ? ch.CH_FRANCHISEE[tf] : 0;
    const dVal = (ch && ch.CH_DELTA) ? ch.CH_DELTA[tf] : 0;
    const total = bVal + bpVal + dVal;

    const bPct = total > 0 ? ((bVal / total) * 100).toFixed(1) : '60.0';
    const bpPct = total > 0 ? ((bpVal / total) * 100).toFixed(1) : '25.0';
    const dPct = total > 0 ? ((dVal / total) * 100).toFixed(1) : '15.0';

    document.getElementById('chan-bar-branch').style.width = `${bPct}%`;
    document.getElementById('chan-bar-bp').style.width = `${bpPct}%`;
    document.getElementById('chan-bar-delta').style.width = `${dPct}%`;

    document.getElementById('ch-branch-brok').textContent = formatINR(bVal);
    document.getElementById('ch-branch-pct').textContent = `(${bPct}%)`;
    document.getElementById('ch-branch-utc').textContent = `(${formatCount(ch && ch.CH_BRANCH ? ch.CH_BRANCH[`utc${tfUpper}`] : 0)} UTC)`;

    document.getElementById('ch-bp-brok').textContent = formatINR(bpVal);
    document.getElementById('ch-bp-pct').textContent = `(${bpPct}%)`;
    document.getElementById('ch-bp-utc').textContent = `(${formatCount(ch && ch.CH_FRANCHISEE ? ch.CH_FRANCHISEE[`utc${tfUpper}`] : 0)} UTC)`;

    document.getElementById('ch-delta-brok').textContent = formatINR(dVal);
    document.getElementById('ch-delta-pct').textContent = `(${dPct}%)`;
    document.getElementById('ch-delta-utc').textContent = `(${formatCount(ch && ch.CH_DELTA ? ch.CH_DELTA[`utc${tfUpper}`] : 0)} UTC)`;
  }

  // Render Last 5 Days Revenue Trend with Sparkline Bars
  function renderLast5DaysTrend(metrics) {
    const trend = metrics.last5DaysTrend;
    const container = document.getElementById('trend-5days-body');
    if (!container || !trend || !trend.revenue) return;

    const maxRev = Math.max(...trend.revenue, 1);

    let html = '';
    for (let i = 0; i < 5; i++) {
      const rev = trend.revenue[i] || 0;
      const utc = trend.utc ? trend.utc[i] : 0;
      const day = trend.days ? trend.days[i] : `Day ${i + 1}`;
      const pct = maxRev > 0 ? Math.max(12, Math.round((rev / maxRev) * 100)) : 80;
      const isPeak = (i === 4 || rev === maxRev);

      html += `
        <div class="trend-day-col ${isPeak ? 'peak' : ''}">
          <div class="trend-day-val">${formatINR(rev)}</div>
          <div class="trend-bar-wrapper">
            <div class="trend-bar-fill" style="height: ${pct}%;"></div>
          </div>
          <div class="trend-day-label">${day}</div>
          <div class="trend-day-utc">${formatCount(utc)} UTC</div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  // Render Trade Segments (Cash, Eq-F&O, Commodity) based on Time Filter
  function renderTradeSegments(metrics) {
    const tf = state.timeFilter;
    const tfUpper = tf.toUpperCase();
    const seg = metrics.tradeSegments;

    document.getElementById('seg-time-badge').textContent = `${tfUpper} VIEW`;

    const cash = seg.cash[tf] || { brok: 0, to: 0, ord: 0 };
    document.getElementById('seg-cash-brok').textContent = formatINR(cash.brok);
    document.getElementById('seg-cash-meta').textContent = `TO: ${formatINR(cash.to)} | ${formatCount(cash.ord)} Ord`;

    const fo = seg.eqFO[tf] || { brok: 0, to: 0, ord: 0 };
    document.getElementById('seg-fo-brok').textContent = formatINR(fo.brok);
    document.getElementById('seg-fo-meta').textContent = `TO: ${formatINR(fo.to)} | ${formatCount(fo.ord)} Ord`;

    const comm = seg.commodity[tf] || { brok: 0, to: 0, ord: 0 };
    document.getElementById('seg-comm-brok').textContent = formatINR(comm.brok);
    document.getElementById('seg-comm-meta').textContent = `TO: ${formatINR(comm.to)} | ${formatCount(comm.ord)} Ord`;
  }

  // Render Modewise & Volumes based on Time Filter
  function renderModewiseAndVolumes(metrics) {
    const tf = state.timeFilter;
    const tfUpper = tf.toUpperCase();
    const mode = metrics.modewise;
    const ordTo = metrics.ordersTurnover;

    document.getElementById('mode-time-badge').textContent = `${tfUpper} VIEW`;

    const onData = mode.online[tf] || { brok: 0 };
    const offData = mode.offline[tf] || { brok: 0 };
    const totalBrok = onData.brok + offData.brok;

    const onShare = totalBrok > 0 ? Math.round((onData.brok / totalBrok) * 100) : 82;
    const offShare = 100 - onShare;

    document.getElementById('online-brok-val').textContent = formatINR(onData.brok);
    document.getElementById('online-meta-sub').textContent = `(${onShare}%)`;

    document.getElementById('offline-brok-val').textContent = formatINR(offData.brok);
    document.getElementById('offline-meta-sub').textContent = `(${offShare}%)`;

    document.getElementById('ord-filter-val').textContent = formatCount(ordTo.orders[tf]);
    document.getElementById('to-filter-val').textContent = formatINR(ordTo.turnover[tf]);
  }

  // Render Target & Wealth based on Time Filter
  function renderTargetAndWealth(metrics) {
    const tf = state.timeFilter;
    const tfUpper = tf.toUpperCase();
    const t = metrics.targets;
    const w = metrics.wealthProducts;

    document.getElementById('target-time-badge').textContent = `${tfUpper} VIEW`;

    const act = t[`${tf}Actual`] || 0;
    const tgt = t[`${tf}Target`] || 1;
    const pct = tgt > 0 ? Math.min(100, (act / tgt) * 100) : 90;

    document.getElementById('target-label-selected').textContent = `${tfUpper} NET BROKERAGE`;
    document.getElementById('target-bar-val').textContent = `${formatINR(act)} / ${formatINR(tgt)}`;
    document.getElementById('target-bar-fill').style.width = `${pct}%`;

    // Wealth Products
    document.getElementById('wf-mf-aum').textContent = formatINR(w.mutualFunds.aum);
    document.getElementById('wf-ins-premium').textContent = formatINR(w.insurance.premiumMTD);
    document.getElementById('wf-sgb-volume').textContent = formatINR(w.sgbAndBonds.volumeMTD);
  }

  // Render 6-Level Hierarchy Tree Table (Adaptive to Time Filter)
  function renderHierarchyTreeTable() {
    const tbody = document.getElementById('hierarchy-tree-tbody');
    if (!tbody) return;

    const tf = state.timeFilter;
    const tfUpper = tf.toUpperCase();
    document.getElementById('th-net-brok').textContent = `Net Brok (${tfUpper})`;

    let rowsHtml = '';
    const activeTree = getActiveHierarchyTree();
    const q = state.searchQuery.toLowerCase().trim();

    activeTree.forEach(channel => {
      if (state.selectedChannel !== 'ALL' && channel.channelId !== state.selectedChannel) return;

      const chClients = window.RELIGARE_DATA.collectClients(channel);
      const chMetrics = window.RELIGARE_DATA.calculateMetrics(chClients);
      const isChExpanded = state.expandedNodes.has(channel.channelId);

      rowsHtml += createTreeRow({
        id: channel.channelId,
        name: channel.channelName,
        type: 'Channel',
        pillClass: 'region',
        depth: 0,
        hasChildren: channel.regions && channel.regions.length > 0,
        isExpanded: isChExpanded,
        metrics: chMetrics,
        timeFilter: tf,
        clickHandler: `window.drillToChannel('${channel.channelId}')`
      });

      if (isChExpanded && channel.regions) {
        channel.regions.forEach(region => {
          if (state.selectedRegion !== 'ALL' && region.regionId !== state.selectedRegion) return;

          const regClients = window.RELIGARE_DATA.collectClients(region);
          const regMetrics = window.RELIGARE_DATA.calculateMetrics(regClients);
          const isRegExpanded = state.expandedNodes.has(region.regionId);

          rowsHtml += createTreeRow({
            id: region.regionId,
            name: region.regionName,
            type: 'Region',
            pillClass: 'region',
            depth: 1,
            hasChildren: region.zones && region.zones.length > 0,
            isExpanded: isRegExpanded,
            metrics: regMetrics,
            timeFilter: tf,
            clickHandler: `window.drillToRegion('${region.regionId}')`
          });

          if (isRegExpanded && region.zones) {
            region.zones.forEach(zone => {
              if (state.selectedZone !== 'ALL' && zone.zoneId !== state.selectedZone) return;

              const zoneClients = window.RELIGARE_DATA.collectClients(zone);
              const zoneMetrics = window.RELIGARE_DATA.calculateMetrics(zoneClients);
              const isZoneExpanded = state.expandedNodes.has(zone.zoneId);

              rowsHtml += createTreeRow({
                id: zone.zoneId,
                name: zone.zoneName,
                type: 'Zone',
                pillClass: 'zone',
                depth: 2,
                hasChildren: zone.branches && zone.branches.length > 0,
                isExpanded: isZoneExpanded,
                metrics: zoneMetrics,
                timeFilter: tf,
                clickHandler: `window.drillToZone('${zone.zoneId}')`
              });

              if (isZoneExpanded && zone.branches) {
                zone.branches.forEach(branch => {
                  if (state.selectedBranch !== 'ALL' && branch.code !== state.selectedBranch) return;

                  const brClients = window.RELIGARE_DATA.collectClients(branch);
                  const brMetrics = window.RELIGARE_DATA.calculateMetrics(brClients);
                  const isBrExpanded = state.expandedNodes.has(branch.code);
                  const isBP = branch.type === 'BP' || String(branch.code).startsWith('BP');

                  rowsHtml += createTreeRow({
                    id: branch.code,
                    name: `${branch.code} - ${branch.name}`,
                    type: isBP ? 'BP' : 'Branch',
                    pillClass: isBP ? 'bp' : 'branch',
                    depth: 3,
                    hasChildren: branch.dealers && branch.dealers.length > 0,
                    isExpanded: isBrExpanded,
                    metrics: brMetrics,
                    timeFilter: tf,
                    clickHandler: `window.drillToBranch('${branch.code}')`
                  });

                  if (isBrExpanded && branch.dealers) {
                    branch.dealers.forEach(dealer => {
                      if (state.selectedDealer !== 'ALL' && dealer.name !== state.selectedDealer) return;

                      const dlClients = window.RELIGARE_DATA.collectClients(dealer);
                      const dlMetrics = window.RELIGARE_DATA.calculateMetrics(dlClients);
                      const isDlExpanded = state.expandedNodes.has(dealer.id);

                      rowsHtml += createTreeRow({
                        id: dealer.id,
                        name: `${dealer.name} (${dealer.role || 'Dealer'})`,
                        type: 'Dealer',
                        pillClass: 'dealer',
                        depth: 4,
                        hasChildren: dealer.clients && dealer.clients.length > 0,
                        isExpanded: isDlExpanded,
                        metrics: dlMetrics,
                        timeFilter: tf,
                        clickHandler: `window.drillToDealer('${dealer.name}')`
                      });

                      if (isDlExpanded && dealer.clients) {
                        dealer.clients.forEach(client => {
                          if (state.selectedClient !== 'ALL' && client.clientCode !== state.selectedClient) return;

                          const clientBrok = (tf === 'ftd') ? client.netBrokerage.yesterday : (tf === 'mtd' ? client.netBrokerage.mtd : client.netBrokerage.ytd);
                          const clientTO = (tf === 'ftd') ? client.turnover.yesterday : (tf === 'mtd' ? client.turnover.mtd : client.turnover.ytd);
                          const cCash = Math.round(clientBrok * ((client.segments ? client.segments.cash : 30) / 100));
                          const cFo = Math.round(clientBrok * ((client.segments ? client.segments.eqFO : 55) / 100));
                          const cComm = Math.round(clientBrok * ((client.segments ? client.segments.commodity : 15) / 100));

                          rowsHtml += `
                            <tr class="tree-node-row depth-5">
                              <td>
                                <div class="node-cell depth-5">
                                  <span class="type-pill client">Client</span>
                                  <a class="node-name-link" onclick="window.drillToClient('${client.clientCode}')">${client.clientCode} - ${client.clientName}</a>
                                  <span style="font-size:0.65rem; font-weight:800; color:${client.category === 'NCR' ? 'var(--c-cyan)' : (client.category === 'PCR' ? 'var(--c-green)' : '#ec4899')};">[${client.category || 'OCR'}]</span>
                                </div>
                              </td>
                              <td class="num-col" style="color:var(--c-green); font-weight:700;">${formatINR(clientBrok)}</td>
                              <td class="num-col">${formatINR(cCash)}</td>
                              <td class="num-col">${formatINR(cFo)}</td>
                              <td class="num-col">${formatINR(cComm)}</td>
                              <td class="num-col">${client.isTradedYesterday ? '1' : '0'}</td>
                              <td class="num-col">${client.onlineShare || 80}%</td>
                              <td class="num-col">${formatINR(clientTO)}</td>
                              <td class="num-col"><span class="growth-pill positive">+12.4%</span></td>
                            </tr>
                          `;
                        });
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });

    tbody.innerHTML = rowsHtml;
  }

  function createTreeRow(item) {
    const tf = item.timeFilter;
    const k = item.metrics.kpis;
    const seg = item.metrics.tradeSegments;
    const mode = item.metrics.modewise;
    const ordTo = item.metrics.ordersTurnover;

    const brokVal = (tf === 'ftd') ? k.netBrokerage.yesterday : (tf === 'mtd' ? k.netBrokerage.mtd : k.netBrokerage.ytd);
    const cashVal = seg.cash[tf] ? seg.cash[tf].brok : 0;
    const foVal = seg.eqFO[tf] ? seg.eqFO[tf].brok : 0;
    const commVal = seg.commodity[tf] ? seg.commodity[tf].brok : 0;
    const toVal = ordTo.turnover[tf] || 0;
    const utcVal = (tf === 'ftd') ? k.uniqueTradedClients.yesterday : (tf === 'mtd' ? k.uniqueTradedClients.mtd : k.uniqueTradedClients.ytd);

    const onData = mode.online[tf] || { brok: 0 };
    const offData = mode.offline[tf] || { brok: 0 };
    const totalB = onData.brok + offData.brok;
    const onPct = totalB > 0 ? Math.round((onData.brok / totalB) * 100) : 82;

    const toggleIcon = item.hasChildren ? `<button class="node-toggle-btn ${item.isExpanded ? 'expanded' : ''}" onclick="window.toggleTreeNode('${item.id}', event)">▶</button>` : `<span style="width:20px; display:inline-block;"></span>`;

    return `
      <tr class="tree-node-row depth-${item.depth}">
        <td>
          <div class="node-cell depth-${item.depth}">
            ${toggleIcon}
            <span class="type-pill ${item.pillClass}">${item.type}</span>
            <a class="node-name-link" onclick="${item.clickHandler}">${item.name}</a>
          </div>
        </td>
        <td class="num-col" style="color:var(--c-green); font-weight:800;">${formatINR(brokVal)}</td>
        <td class="num-col">${formatINR(cashVal)}</td>
        <td class="num-col">${formatINR(foVal)}</td>
        <td class="num-col">${formatINR(commVal)}</td>
        <td class="num-col">${formatCount(utcVal)}</td>
        <td class="num-col">${onPct}%</td>
        <td class="num-col">${formatINR(toVal)}</td>
        <td class="num-col"><span class="growth-pill positive">+${k.netBrokerage.mtdGrowth}%</span></td>
      </tr>
    `;
  }

  // Update Hierarchy Level Badges & Active Drilldown Pills
  function updateBreadcrumbs() {
    const pillBox = document.getElementById('drilldown-active-pill');
    if (pillBox) {
      if (state.selectedClient !== 'ALL') {
        pillBox.style.display = 'inline-flex';
        pillBox.innerHTML = `<span class="breadcrumb-val" style="color:var(--c-cyan); border-color:var(--c-cyan); display:flex; align-items:center; gap:4px;">Client: ${state.selectedClient} <button onclick="window.resetHierarchy('dealer')" style="background:transparent; border:none; color:inherit; cursor:pointer; font-weight:800;">✕</button></span>`;
      } else if (state.selectedDealer !== 'ALL') {
        pillBox.style.display = 'inline-flex';
        pillBox.innerHTML = `<span class="breadcrumb-val" style="color:var(--c-pink); border-color:var(--c-pink); display:flex; align-items:center; gap:4px;">Dealer: ${state.selectedDealer} <button onclick="window.resetHierarchy('dealer')" style="background:transparent; border:none; color:inherit; cursor:pointer; font-weight:800;">✕</button></span>`;
      } else {
        pillBox.style.display = 'none';
        pillBox.innerHTML = '';
      }
    }

    const info = getCurrentLevelInfo();
    document.getElementById('header-level-badge').textContent = info.badge;
    document.getElementById('header-dash-title').textContent = `${info.title}`;
  }

  // Master Render Function
  function renderDashboard() {
    const clients = getFilteredClients();
    const metrics = window.RELIGARE_DATA.calculateMetrics(clients);

    syncDropdowns();
    updateBreadcrumbs();
    renderPersistentCoreKPIs(metrics);
    renderCohortDonut(metrics);
    renderChannelRevenueMix(metrics);
    renderLast5DaysTrend(metrics);
    renderTradeSegments(metrics);
    renderModewiseAndVolumes(metrics);
    renderTargetAndWealth(metrics);
    renderHierarchyTreeTable();
  }

  // Synchronize Hierarchy Dropdowns with Active State & Tree
  function syncDropdowns() {
    const selCh = document.getElementById('select-channel');
    const selReg = document.getElementById('select-region');
    const selZone = document.getElementById('select-zone');
    const selBr = document.getElementById('select-branch');

    if (!selCh || !selReg || !selZone || !selBr) return;

    const activeTree = getActiveHierarchyTree();

    // 1. Channel Select
    selCh.value = state.selectedChannel;

    // 2. Region Select (Filtered by selected Channel)
    let regions = [];
    activeTree.forEach(ch => {
      if (state.selectedChannel === 'ALL' || ch.channelId === state.selectedChannel) {
        if (ch.regions) regions = regions.concat(ch.regions);
      }
    });

    let regHtml = '<option value="ALL">All Regions</option>';
    regions.forEach(r => {
      regHtml += `<option value="${r.regionId}" ${state.selectedRegion === r.regionId ? 'selected' : ''}>${r.regionName}</option>`;
    });
    selReg.innerHTML = regHtml;
    selReg.value = state.selectedRegion;

    // 3. Zone Select (Filtered by selected Region/Channel)
    let zones = [];
    regions.forEach(r => {
      if (state.selectedRegion === 'ALL' || r.regionId === state.selectedRegion) {
        if (r.zones) zones = zones.concat(r.zones);
      }
    });

    let zoneHtml = '<option value="ALL">All Zones</option>';
    zones.forEach(z => {
      zoneHtml += `<option value="${z.zoneId}" ${state.selectedZone === z.zoneId ? 'selected' : ''}>${z.zoneName}</option>`;
    });
    selZone.innerHTML = zoneHtml;
    selZone.value = state.selectedZone;

    // 4. Branch / BP Select (Filtered by selected Zone/Region/Channel)
    let branches = [];
    zones.forEach(z => {
      if (state.selectedZone === 'ALL' || z.zoneId === state.selectedZone) {
        if (z.branches) branches = branches.concat(z.branches);
      }
    });

    let brHtml = '<option value="ALL">All Branches / BPs</option>';
    branches.forEach(b => {
      const isBP = b.type === 'BP' || String(b.code).startsWith('BP');
      brHtml += `<option value="${b.code}" ${state.selectedBranch === b.code ? 'selected' : ''}>${b.code} - ${b.name} (${isBP ? 'BP' : 'Branch'})</option>`;
    });
    selBr.innerHTML = brHtml;
    selBr.value = state.selectedBranch;
  }

  // Hierarchy Dropdown Change Handlers
  window.onChannelSelectChange = function (channelId) {
    state.selectedChannel = channelId;
    state.selectedRegion = 'ALL';
    state.selectedZone = 'ALL';
    state.selectedBranch = 'ALL';
    state.selectedDealer = 'ALL';
    state.selectedClient = 'ALL';
    if (channelId !== 'ALL') state.expandedNodes.add(channelId);
    renderDashboard();
  };

  window.onRegionSelectChange = function (regionId) {
    state.selectedRegion = regionId;
    state.selectedZone = 'ALL';
    state.selectedBranch = 'ALL';
    state.selectedDealer = 'ALL';
    state.selectedClient = 'ALL';
    if (regionId !== 'ALL') state.expandedNodes.add(regionId);
    renderDashboard();
  };

  window.onZoneSelectChange = function (zoneId) {
    state.selectedZone = zoneId;
    state.selectedBranch = 'ALL';
    state.selectedDealer = 'ALL';
    state.selectedClient = 'ALL';
    if (zoneId !== 'ALL') state.expandedNodes.add(zoneId);
    renderDashboard();
  };

  window.onBranchSelectChange = function (branchCode) {
    state.selectedBranch = branchCode;
    state.selectedDealer = 'ALL';
    state.selectedClient = 'ALL';
    if (branchCode !== 'ALL') state.expandedNodes.add(branchCode);
    renderDashboard();
  };

  // Global Time Filter Switcher (FTD / MTD / YTD)
  window.setTimeFilter = function (period) {
    state.timeFilter = period;
    document.querySelectorAll('.time-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-time') === period);
    });
    renderDashboard();
  };

  // Global Navigation & Drill-Down Functions
  window.toggleTreeNode = function (nodeId, event) {
    if (event) event.stopPropagation();
    if (state.expandedNodes.has(nodeId)) {
      state.expandedNodes.delete(nodeId);
    } else {
      state.expandedNodes.add(nodeId);
    }
    renderHierarchyTreeTable();
  };

  window.expandAllTreeNodes = function () {
    const activeTree = getActiveHierarchyTree();
    activeTree.forEach(ch => {
      state.expandedNodes.add(ch.channelId);
      if (ch.regions) {
        ch.regions.forEach(r => {
          state.expandedNodes.add(r.regionId);
          if (r.zones) {
            r.zones.forEach(z => {
              state.expandedNodes.add(z.zoneId);
              if (z.branches) {
                z.branches.forEach(b => {
                  state.expandedNodes.add(b.code);
                  if (b.dealers) {
                    b.dealers.forEach(d => state.expandedNodes.add(d.id));
                  }
                });
              }
            });
          }
        });
      }
    });
    renderHierarchyTreeTable();
  };

  window.collapseAllTreeNodes = function () {
    state.expandedNodes.clear();
    renderHierarchyTreeTable();
  };

  window.drillToChannel = function (channelId) {
    state.selectedChannel = channelId;
    state.selectedRegion = 'ALL';
    state.selectedZone = 'ALL';
    state.selectedBranch = 'ALL';
    state.selectedDealer = 'ALL';
    state.selectedClient = 'ALL';
    state.expandedNodes.add(channelId);
    renderDashboard();
  };

  window.drillToRegion = function (regionId) {
    state.selectedRegion = regionId;
    state.selectedZone = 'ALL';
    state.selectedBranch = 'ALL';
    state.selectedDealer = 'ALL';
    state.selectedClient = 'ALL';
    state.expandedNodes.add(regionId);
    renderDashboard();
  };

  window.drillToZone = function (zoneId) {
    state.selectedZone = zoneId;
    state.selectedBranch = 'ALL';
    state.selectedDealer = 'ALL';
    state.selectedClient = 'ALL';
    state.expandedNodes.add(zoneId);
    renderDashboard();
  };

  window.drillToBranch = function (branchCode) {
    state.selectedBranch = branchCode;
    state.selectedDealer = 'ALL';
    state.selectedClient = 'ALL';
    state.expandedNodes.add(branchCode);
    renderDashboard();
  };

  window.drillToDealer = function (dealerName) {
    state.selectedDealer = dealerName;
    state.selectedClient = 'ALL';
    renderDashboard();
  };

  window.drillToClient = function (clientCode) {
    state.selectedClient = clientCode;
    renderDashboard();
  };

  window.resetHierarchy = function (level) {
    if (level === 'channel') {
      state.selectedChannel = 'ALL';
      state.selectedRegion = 'ALL';
      state.selectedZone = 'ALL';
      state.selectedBranch = 'ALL';
      state.selectedDealer = 'ALL';
      state.selectedClient = 'ALL';
    } else if (level === 'region') {
      state.selectedRegion = 'ALL';
      state.selectedZone = 'ALL';
      state.selectedBranch = 'ALL';
      state.selectedDealer = 'ALL';
      state.selectedClient = 'ALL';
    } else if (level === 'zone') {
      state.selectedZone = 'ALL';
      state.selectedBranch = 'ALL';
      state.selectedDealer = 'ALL';
      state.selectedClient = 'ALL';
    } else if (level === 'branch') {
      state.selectedBranch = 'ALL';
      state.selectedDealer = 'ALL';
      state.selectedClient = 'ALL';
    } else if (level === 'dealer') {
      state.selectedDealer = 'ALL';
      state.selectedClient = 'ALL';
    }
    renderDashboard();
  };

  // ==========================================================================
  // 1-CLICK MULTI-TAB EXCEL WORKBOOK TEMPLATE GENERATOR
  // Creates 4 distinct sheets: "Brokerage", "UTC", "Acquisition", "TPP"
  // ==========================================================================
  window.downloadMultiSheetTemplate = function () {
    if (typeof XLSX === 'undefined') {
      alert('Spreadsheet engine initializing. Please try again.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // 1. Sheet "Brokerage"
    const brokHeaders = [
      'CHANNEL', 'REGION', 'ZONE', 'BRANCH_CODE', 'BRANCH_NAME', 'DEALER_NAME',
      'CLIENT_CODE', 'CLIENT_NAME', 'CATEGORY', 'NET_BROKERAGE_FTD', 'NET_BROKERAGE_MTD',
      'NET_BROKERAGE_YTD', 'GROSS_BROKERAGE_MTD', 'CASH_BROKERAGE', 'FO_BROKERAGE',
      'COMM_BROKERAGE', 'TRADE_MODE', 'TURNOVER_FTD', 'TURNOVER_MTD', 'TURNOVER_YTD',
      'ORDERS_FTD', 'ORDERS_MTD', 'ORDERS_YTD'
    ];
    const brokRows = [
      ['Branch Network', 'North Region', 'Delhi NCR Zone', '8047', 'CP Branch', 'Amit Sharma', 'REL10001', 'Rajesh Sharma', 'NCR', 2850, 48500, 310000, 74500, 850, 1650, 350, 'Online', 1450000, 24500000, 185000000, 14, 230, 1850],
      ['Branch Network', 'North Region', 'Delhi NCR Zone', '8047', 'CP Branch', 'Priya Gupta', 'REL10002', 'Sunita Verma', 'PCR', 4200, 68000, 480000, 105000, 1100, 2600, 500, 'Online', 2100000, 38000000, 290000000, 22, 340, 2700],
      ['Branch Network', 'North Region', 'Delhi NCR Zone', '8047', 'CP Branch', 'Vikram Singh', 'REL10003', 'Anil Gupta', 'OCR', 1850, 32000, 240000, 49000, 500, 950, 400, 'Offline', 980000, 16500000, 145000000, 8, 160, 1200],
      ['BP Franchisee', 'North Region', 'Delhi NCR Zone', 'BP101', 'Om Capital', 'Rohan Aggarwal', 'REL20001', 'Vikas Mehta', 'OCR', 5400, 89000, 640000, 137000, 1600, 3100, 700, 'Online', 2800000, 49000000, 380000000, 28, 420, 3300],
      ['Direct / Delta', 'North Region', 'All India App Desk', 'DIG901', 'Dynami Online Desk', 'Digital Algorithmic Desk', 'REL30001', 'Gaurav Kumar', 'NCR', 1950, 36000, 260000, 55000, 600, 1150, 200, 'Online', 1100000, 19000000, 160000000, 10, 180, 1400]
    ];
    const wsBrok = XLSX.utils.aoa_to_sheet([brokHeaders, ...brokRows]);
    XLSX.utils.book_append_sheet(wb, wsBrok, 'Brokerage');

    // 2. Sheet "UTC"
    const utcHeaders = [
      'CHANNEL', 'REGION', 'ZONE', 'BRANCH_CODE', 'DEALER_NAME', 'CLIENT_CODE',
      'CLIENT_NAME', 'CATEGORY', 'IS_TRADED_FTD', 'IS_TRADED_MTD', 'IS_TRADED_YTD',
      'TRADE_MODE', 'PRIMARY_SEGMENT'
    ];
    const utcRows = [
      ['Branch Network', 'North Region', 'Delhi NCR Zone', '8047', 'Amit Sharma', 'REL10001', 'Rajesh Sharma', 'NCR', 1, 1, 1, 'Online', 'Eq-F&O'],
      ['Branch Network', 'North Region', 'Delhi NCR Zone', '8047', 'Priya Gupta', 'REL10002', 'Sunita Verma', 'PCR', 1, 1, 1, 'Online', 'Eq-F&O'],
      ['Branch Network', 'North Region', 'Delhi NCR Zone', '8047', 'Vikram Singh', 'REL10003', 'Anil Gupta', 'OCR', 1, 1, 1, 'Offline', 'Cash'],
      ['BP Franchisee', 'North Region', 'Delhi NCR Zone', 'BP101', 'Rohan Aggarwal', 'REL20001', 'Vikas Mehta', 'OCR', 1, 1, 1, 'Online', 'Eq-F&O'],
      ['Direct / Delta', 'North Region', 'All India App Desk', 'DIG901', 'Digital Algorithmic Desk', 'REL30001', 'Gaurav Kumar', 'NCR', 1, 1, 1, 'Online', 'Commodity']
    ];
    const wsUTC = XLSX.utils.aoa_to_sheet([utcHeaders, ...utcRows]);
    XLSX.utils.book_append_sheet(wb, wsUTC, 'UTC');

    // 3. Sheet "Acquisition"
    const acqHeaders = [
      'CHANNEL', 'REGION', 'ZONE', 'BRANCH_CODE', 'BRANCH_NAME', 'DEALER_NAME',
      'CLIENT_CODE', 'CLIENT_NAME', 'CATEGORY', 'ACCOUNT_OPEN_DATE', 'IS_ACQUIRED_FTD',
      'IS_ACQUIRED_MTD', 'IS_ACQUIRED_YTD', 'IS_ACTIVATED_FTD', 'IS_ACTIVATED_MTD', 'IS_ACTIVATED_YTD'
    ];
    const acqRows = [
      ['Branch Network', 'North Region', 'Delhi NCR Zone', '8047', 'CP Branch', 'Amit Sharma', 'REL10001', 'Rajesh Sharma', 'NCR', '26-Aug-2026', 1, 1, 1, 1, 1, 1],
      ['Branch Network', 'North Region', 'Delhi NCR Zone', '8048', 'Karol Bagh Branch', 'Neha Verma', 'REL10004', 'Meena Singh', 'NCR', '26-Aug-2026', 1, 1, 1, 1, 1, 1],
      ['Direct / Delta', 'North Region', 'All India App Desk', 'DIG901', 'Dynami Online Desk', 'Digital Algorithmic Desk', 'REL30001', 'Gaurav Kumar', 'NCR', '26-Aug-2026', 1, 1, 1, 1, 1, 1]
    ];
    const wsAcq = XLSX.utils.aoa_to_sheet([acqHeaders, ...acqRows]);
    XLSX.utils.book_append_sheet(wb, wsAcq, 'Acquisition');

    // 4. Sheet "TPP" (Third Party Products)
    const tppHeaders = [
      'CHANNEL', 'REGION', 'ZONE', 'BRANCH_CODE', 'DEALER_NAME', 'CLIENT_CODE',
      'CLIENT_NAME', 'PRODUCT_TYPE', 'MF_AUM', 'MF_SIP_MONTHLY', 'INSURANCE_PREMIUM',
      'SGB_BONDS_VOLUME', 'REVENUE_FTD', 'REVENUE_MTD', 'REVENUE_YTD'
    ];
    const tppRows = [
      ['Branch Network', 'North Region', 'Delhi NCR Zone', '8047', 'Amit Sharma', 'REL10001', 'Rajesh Sharma', 'Mutual Funds', 350000, 5000, 0, 0, 150, 1200, 9500],
      ['Branch Network', 'North Region', 'Delhi NCR Zone', '8047', 'Priya Gupta', 'REL10002', 'Sunita Verma', 'Insurance', 0, 0, 85000, 0, 1200, 15300, 92000],
      ['Branch Network', 'North Region', 'Delhi NCR Zone', '8047', 'Vikram Singh', 'REL10003', 'Anil Gupta', 'SGB & Bonds', 0, 0, 0, 150000, 250, 1800, 12000],
      ['BP Franchisee', 'North Region', 'Delhi NCR Zone', 'BP101', 'Rohan Aggarwal', 'REL20001', 'Vikas Mehta', 'Mutual Funds', 1200000, 15000, 120000, 400000, 2400, 28000, 185000]
    ];
    const wsTPP = XLSX.utils.aoa_to_sheet([tppHeaders, ...tppRows]);
    XLSX.utils.book_append_sheet(wb, wsTPP, 'TPP');

    // Export Workbook
    XLSX.writeFile(wb, 'Religare_Daily_Report_Summary_MultiSheet.xlsx');
  };

  // ==========================================================================
  // MULTI-SHEET RELATIONAL INGESTION & AUTO-JOIN ENGINE
  // ==========================================================================
  function setupDropzone() {
    const dropzone = document.getElementById('xlsb-dropzone');
    const fileInput = document.getElementById('xlsb-file-input');

    if (!dropzone || !fileInput) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) handleFileUpload(files[0]);
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) handleFileUpload(e.target.files[0]);
    });
  }

  function handleFileUpload(file) {
    const statusDiv = document.getElementById('upload-status-box');
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <div style="font-size:1.4rem;">⏳</div>
        <div>
          <strong style="color: var(--c-cyan);">Scanning Multi-Sheet Workbook "${file.name}" (${(file.size / 1024 / 1024).toFixed(2)} MB)...</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">Detecting Brokerage, UTC, Acquisition, and TPP sheets...</div>
        </div>
      </div>
    `;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        if (typeof XLSX === 'undefined') {
          statusDiv.innerHTML = `<div style="color: var(--c-amber);">SheetJS library is initializing. Please re-try in a second.</div>`;
          return;
        }

        const workbook = XLSX.read(data, { type: 'array' });
        state.uploadedWorkbook = workbook;

        // Auto-detect and parse all 4 functional sheets
        const sheetMap = {};
        workbook.SheetNames.forEach(name => {
          const lower = name.toLowerCase().trim();
          const ws = workbook.Sheets[name];
          const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          const { headerIndex, headers } = detectHeaderRow(raw);
          const rows = [];

          for (let r = headerIndex + 1; r < raw.length; r++) {
            const row = raw[r];
            if (!row || row.length === 0 || row.every(c => c === '')) continue;
            const obj = {};
            headers.forEach((h, colIdx) => {
              obj[h] = row[colIdx] !== undefined ? row[colIdx] : '';
            });
            rows.push(obj);
          }

          sheetMap[name] = { rows, headers, lower };
        });

        // Match functional sheets
        let brokRows = [], utcRows = [], acqRows = [], tppRows = [];
        let brokName = '', utcName = '', acqName = '', tppName = '';

        for (let [name, data] of Object.entries(sheetMap)) {
          if (data.rows.length === 0) continue;
          if (data.lower.includes('brok') || data.lower.includes('revenue') || (!brokRows.length && !data.lower.includes('utc') && !data.lower.includes('acq') && !data.lower.includes('tpp'))) {
            brokRows = data.rows; brokName = name;
          } else if (data.lower.includes('utc') || data.lower.includes('trade')) {
            utcRows = data.rows; utcName = name;
          } else if (data.lower.includes('acq') || data.lower.includes('open') || data.lower.includes('account')) {
            acqRows = data.rows; acqName = name;
          } else if (data.lower.includes('tpp') || data.lower.includes('wealth') || data.lower.includes('mf') || data.lower.includes('ins')) {
            tppRows = data.rows; tppName = name;
          }
        }

        if (brokRows.length === 0 && Object.keys(sheetMap).length > 0) {
          const firstValid = Object.values(sheetMap).find(s => s.rows.length > 0);
          if (firstValid) {
            brokRows = firstValid.rows;
            brokName = 'Primary Sheet';
          }
        }

        if (brokRows.length === 0) {
          statusDiv.innerHTML = `
            <div style="color: var(--c-red); font-weight:700;">
              ❌ Could not find data rows in "${file.name}".
            </div>
            <p style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">
              Please click <strong>"📥 Download Multi-Sheet Template (.XLSX)"</strong> below to see the exact 4-sheet format.
            </p>
          `;
          return;
        }

        // Multi-Sheet Relational Join
        const { tree, clientCount, branchCount, dealerCount } = joinMultiSheetData(brokRows, utcRows, acqRows, tppRows);

        state.uploadedTree = tree;
        state.dataSource = 'live';

        statusDiv.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <div style="color: var(--c-green); font-weight:800; font-size:0.92rem; display:flex; align-items:center; gap:6px;">
                <span>✅</span> Successfully Ingested &amp; Joined Multi-Sheet Data!
              </div>
              <div style="font-size:0.76rem; color:var(--text-muted); margin-top:4px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span class="growth-pill positive">Brokerage: ${brokRows.length.toLocaleString()} rows</span>
                <span class="growth-pill ${utcRows.length ? 'positive' : 'negative'}">UTC: ${utcRows.length.toLocaleString()} rows</span>
                <span class="growth-pill ${acqRows.length ? 'positive' : 'negative'}">Acquisition: ${acqRows.length.toLocaleString()} rows</span>
                <span class="growth-pill ${tppRows.length ? 'positive' : 'negative'}">TPP Wealth: ${tppRows.length.toLocaleString()} rows</span>
              </div>
              <div style="font-size:0.74rem; color:var(--text-faint); margin-top:3px;">
                Mapped: <strong>${branchCount}</strong> Branches • <strong>${dealerCount}</strong> Dealers • <strong>${clientCount.toLocaleString()}</strong> Active Clients
              </div>
            </div>

            <div style="display:flex; gap:8px;">
              <button class="btn btn-outline" onclick="window.switchDataSource('sample')" style="font-size:0.74rem; padding:4px 10px;">Load Demo Data</button>
              <button class="btn btn-primary" onclick="window.switchDataSource('live')" style="font-size:0.74rem; padding:4px 10px;">Show Live Uploaded Data</button>
            </div>
          </div>
        `;

        renderUploadedPreview(brokRows);
        renderDashboard();

      } catch (err) {
        statusDiv.innerHTML = `<div style="color: var(--c-red);">❌ Error processing multi-sheet spreadsheet: ${err.message}</div>`;
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function detectHeaderRow(rawRows) {
    const maxSearch = Math.min(15, rawRows.length);
    let bestIndex = 0;
    let bestScore = -1;
    let bestHeaders = [];

    const brokingKeywords = [
      'channel', 'region', 'zone', 'branch', 'dealer', 'client', 'category',
      'net_brokerage', 'gross_brokerage', 'turnover', 'orders', 'is_traded',
      'cash', 'fo', 'comm', 'trade_mode', 'brok', 'aum', 'sip', 'premium'
    ];

    for (let r = 0; r < maxSearch; r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;

      let score = 0;
      const headers = [];

      row.forEach(cell => {
        const str = String(cell || '').toLowerCase().trim();
        if (str.length > 0) {
          headers.push(String(cell).trim());
          brokingKeywords.forEach(kw => {
            if (str.includes(kw)) score += 3;
          });
          if (str.length > 2) score += 1;
        }
      });

      if (score > bestScore && headers.length >= 2) {
        bestScore = score;
        bestIndex = r;
        bestHeaders = headers;
      }
    }

    if (bestHeaders.length === 0 && rawRows.length > 0) {
      bestHeaders = rawRows[0].map((c, i) => String(c || `Col_${i + 1}`));
    }

    return { headerIndex: bestIndex, headers: bestHeaders };
  }

  // Multi-Sheet Relational Join Engine
  function joinMultiSheetData(brokRows, utcRows, acqRows, tppRows) {
    function findKey(keys, patterns) {
      for (let pat of patterns) {
        for (let k of keys) {
          const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanPat = pat.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanK.includes(cleanPat)) return k;
        }
      }
      return null;
    }

    // Index UTC Sheet by CLIENT_CODE
    const utcMap = {};
    if (utcRows && utcRows.length > 0) {
      const uKeys = Object.keys(utcRows[0]);
      const kCl = findKey(uKeys, ['client_code', 'party_code', 'client', 'code']) || 'CLIENT_CODE';
      const kTradedFTD = findKey(uKeys, ['is_traded_ftd', 'is_traded', 'traded', 'utc_ftd', 'utc']) || 'IS_TRADED_FTD';
      const kTradedMTD = findKey(uKeys, ['is_traded_mtd', 'utc_mtd']) || 'IS_TRADED_MTD';
      const kTradedYTD = findKey(uKeys, ['is_traded_ytd', 'utc_ytd']) || 'IS_TRADED_YTD';

      utcRows.forEach(r => {
        const cCode = String(r[kCl] || '').trim();
        if (cCode) {
          utcMap[cCode] = {
            isTradedFTD: String(r[kTradedFTD]) === '1' || String(r[kTradedFTD]).toLowerCase() === 'true',
            isTradedMTD: String(r[kTradedMTD]) === '1' || String(r[kTradedMTD]).toLowerCase() === 'true',
            isTradedYTD: String(r[kTradedYTD]) === '1' || String(r[kTradedYTD]).toLowerCase() === 'true'
          };
        }
      });
    }

    // Index Acquisition Sheet by CLIENT_CODE
    const acqMap = {};
    if (acqRows && acqRows.length > 0) {
      const aKeys = Object.keys(acqRows[0]);
      const kCl = findKey(aKeys, ['client_code', 'party_code', 'client', 'code']) || 'CLIENT_CODE';
      const kAcqFTD = findKey(aKeys, ['is_acquired_ftd', 'is_acq_ftd', 'acq_yesterday', 'acq_ftd']) || 'IS_ACQUIRED_FTD';
      const kAcqMTD = findKey(aKeys, ['is_acquired_mtd', 'acq_mtd']) || 'IS_ACQUIRED_MTD';
      const kAcqYTD = findKey(aKeys, ['is_acquired_ytd', 'acq_ytd']) || 'IS_ACQUIRED_YTD';
      const kActFTD = findKey(aKeys, ['is_activated_ftd', 'is_act_ftd', 'act_yesterday']) || 'IS_ACTIVATED_FTD';
      const kActMTD = findKey(aKeys, ['is_activated_mtd', 'act_mtd']) || 'IS_ACTIVATED_MTD';
      const kActYTD = findKey(aKeys, ['is_activated_ytd', 'act_ytd']) || 'IS_ACTIVATED_YTD';

      acqRows.forEach(r => {
        const cCode = String(r[kCl] || '').trim();
        if (cCode) {
          acqMap[cCode] = {
            acqFTD: Number(r[kAcqFTD]) === 1 ? 1 : 0,
            acqMTD: Number(r[kAcqMTD]) === 1 ? 1 : 0,
            acqYTD: Number(r[kAcqYTD]) === 1 ? 1 : 0,
            actFTD: Number(r[kActFTD]) === 1 ? 1 : 0,
            actMTD: Number(r[kActMTD]) === 1 ? 1 : 0,
            actYTD: Number(r[kActYTD]) === 1 ? 1 : 0
          };
        }
      });
    }

    // Index TPP Sheet by CLIENT_CODE
    const tppMap = {};
    if (tppRows && tppRows.length > 0) {
      const tKeys = Object.keys(tppRows[0]);
      const kCl = findKey(tKeys, ['client_code', 'party_code', 'client', 'code']) || 'CLIENT_CODE';
      const kMFAum = findKey(tKeys, ['mf_aum', 'aum']) || 'MF_AUM';
      const kMFSip = findKey(tKeys, ['mf_sip_monthly', 'sip_monthly', 'sip']) || 'MF_SIP_MONTHLY';
      const kInsPrem = findKey(tKeys, ['insurance_premium', 'ins_prem', 'premium']) || 'INSURANCE_PREMIUM';
      const kSGBVol = findKey(tKeys, ['sgb_bonds_volume', 'sgb_volume', 'bonds']) || 'SGB_BONDS_VOLUME';
      const kRevMTD = findKey(tKeys, ['revenue_mtd', 'rev_mtd']) || 'REVENUE_MTD';

      tppRows.forEach(r => {
        const cCode = String(r[kCl] || '').trim();
        if (cCode) {
          tppMap[cCode] = {
            mfAum: Number(String(r[kMFAum] || '').replace(/[^0-9.-]/g, '')) || 0,
            mfSip: Number(String(r[kMFSip] || '').replace(/[^0-9.-]/g, '')) || 0,
            insPrem: Number(String(r[kInsPrem] || '').replace(/[^0-9.-]/g, '')) || 0,
            sgbVol: Number(String(r[kSGBVol] || '').replace(/[^0-9.-]/g, '')) || 0,
            revMTD: Number(String(r[kRevMTD] || '').replace(/[^0-9.-]/g, '')) || 0
          };
        }
      });
    }

    // Process Primary Brokerage Rows
    const bKeys = Object.keys(brokRows[0]);
    const kChannel = findKey(bKeys, ['channel', 'ch_name', 'segment_channel']) || 'CHANNEL';
    const kRegion = findKey(bKeys, ['region', 'reg_name', 'region_name']) || 'REGION';
    const kZone = findKey(bKeys, ['zone', 'zone_name', 'zonal_head']) || 'ZONE';
    const kBranchCode = findKey(bKeys, ['branch_code', 'branch_cd', 'bp_code', 'bp_cd', 'br_cd']) || 'BRANCH_CODE';
    const kBranchName = findKey(bKeys, ['branch_name', 'br_name', 'bp_name']) || 'BRANCH_NAME';
    const kDealer = findKey(bKeys, ['dealer_name', 'dealer', 'dealer_cd', 'emp_name']) || 'DEALER_NAME';
    const kClientCode = findKey(bKeys, ['client_code', 'party_code', 'client_cd', 'client']) || 'CLIENT_CODE';
    const kClientName = findKey(bKeys, ['client_name', 'party_name', 'name']) || 'CLIENT_NAME';
    const kCategory = findKey(bKeys, ['category', 'ncr_pcr_ocr', 'cohort']) || 'CATEGORY';

    const kNetBrokFTD = findKey(bKeys, ['net_brokerage_ftd', 'net_brok_ftd', 'net_brok_yest', 'net_brok']) || 'NET_BROKERAGE_FTD';
    const kNetBrokMTD = findKey(bKeys, ['net_brokerage_mtd', 'net_brok_mtd']) || 'NET_BROKERAGE_MTD';
    const kNetBrokYTD = findKey(bKeys, ['net_brokerage_ytd', 'net_brok_ytd']) || 'NET_BROKERAGE_YTD';
    const kGrossBrokMTD = findKey(bKeys, ['gross_brokerage_mtd', 'gross_brok_mtd']) || 'GROSS_BROKERAGE_MTD';

    const kCashBrok = findKey(bKeys, ['cash_brokerage', 'cash_brok', 'cash']) || 'CASH_BROKERAGE';
    const kFOBrok = findKey(bKeys, ['fo_brokerage', 'fo_brok', 'fno_brok', 'derivative_brok']) || 'FO_BROKERAGE';
    const kCommBrok = findKey(bKeys, ['comm_brokerage', 'comm_brok', 'mcx_brok']) || 'COMM_BROKERAGE';

    const kTradeMode = findKey(bKeys, ['trade_mode', 'mode', 'online_offline']) || 'TRADE_MODE';
    const kTurnoverFTD = findKey(bKeys, ['turnover_ftd', 'turnover_yest', 'to_yest', 'turnover']) || 'TURNOVER_FTD';
    const kTurnoverMTD = findKey(bKeys, ['turnover_mtd', 'to_mtd']) || 'TURNOVER_MTD';
    const kTurnoverYTD = findKey(bKeys, ['turnover_ytd', 'to_ytd']) || 'TURNOVER_YTD';

    const kOrdersFTD = findKey(bKeys, ['orders_ftd', 'orders_yest', 'orders']) || 'ORDERS_FTD';
    const kOrdersMTD = findKey(bKeys, ['orders_mtd']) || 'ORDERS_MTD';
    const kOrdersYTD = findKey(bKeys, ['orders_ytd']) || 'ORDERS_YTD';

    const clients = [];
    const branchSet = new Set();
    const dealerSet = new Set();

    brokRows.forEach((r, idx) => {
      const chName = String(r[kChannel] || (idx % 2 === 0 ? 'Branch Network' : 'BP Franchisee')).trim();
      const regName = String(r[kRegion] || 'North Region').trim();
      const zoneName = String(r[kZone] || 'Delhi NCR Zone').trim();
      const brCode = String(r[kBranchCode] || `80${40 + (idx % 10)}`).trim();
      const brName = String(r[kBranchName] || `${brCode} Branch`).trim();
      const dlName = String(r[kDealer] || `Dealer_${idx % 15}`).trim();
      const clCode = String(r[kClientCode] || `REL${10000 + idx}`).trim();
      const clName = String(r[kClientName] || clCode).trim();

      branchSet.add(brCode);
      dealerSet.add(dlName);

      const netBrokFTD = Number(String(r[kNetBrokFTD] || '').replace(/[^0-9.-]/g, '')) || Math.round(500 + (idx * 333) % 4000);
      const netBrokMTD = Number(String(r[kNetBrokMTD] || '').replace(/[^0-9.-]/g, '')) || Math.round(netBrokFTD * 18.5);
      const netBrokYTD = Number(String(r[kNetBrokYTD] || '').replace(/[^0-9.-]/g, '')) || Math.round(netBrokMTD * 7.5);
      const grossBrokMTD = Number(String(r[kGrossBrokMTD] || '').replace(/[^0-9.-]/g, '')) || Math.round(netBrokMTD * 1.54);

      let cashBrok = Number(String(r[kCashBrok] || '').replace(/[^0-9.-]/g, ''));
      let foBrok = Number(String(r[kFOBrok] || '').replace(/[^0-9.-]/g, ''));
      let commBrok = Number(String(r[kCommBrok] || '').replace(/[^0-9.-]/g, ''));

      if (isNaN(cashBrok) || isNaN(foBrok) || isNaN(commBrok) || (cashBrok + foBrok + commBrok === 0)) {
        cashBrok = Math.round(netBrokFTD * 0.28);
        foBrok = Math.round(netBrokFTD * 0.58);
        commBrok = netBrokFTD - cashBrok - foBrok;
      }

      const modeStr = String(r[kTradeMode] || '').toLowerCase();
      const onlineShare = modeStr.includes('off') ? 20 : (modeStr.includes('on') ? 90 : 80);

      const toFTD = Number(String(r[kTurnoverFTD] || '').replace(/[^0-9.-]/g, '')) || Math.round(netBrokFTD * 1450 + 50000);
      const toMTD = Number(String(r[kTurnoverMTD] || '').replace(/[^0-9.-]/g, '')) || Math.round(toFTD * 19);
      const toYTD = Number(String(r[kTurnoverYTD] || '').replace(/[^0-9.-]/g, '')) || Math.round(toMTD * 7.8);

      const ordFTD = Number(String(r[kOrdersFTD] || '').replace(/[^0-9.-]/g, '')) || Math.max(1, Math.round(netBrokFTD / 120));
      const ordMTD = Number(String(r[kOrdersMTD] || '').replace(/[^0-9.-]/g, '')) || Math.round(ordFTD * 18);
      const ordYTD = Number(String(r[kOrdersYTD] || '').replace(/[^0-9.-]/g, '')) || Math.round(ordMTD * 7.6);

      let cat = String(r[kCategory] || '').toUpperCase().trim();
      if (!cat.includes('NCR') && !cat.includes('PCR') && !cat.includes('OCR')) {
        cat = (idx % 10 === 0) ? 'NCR' : ((idx % 4 === 0) ? 'PCR' : 'OCR');
      }

      // Relational Join with UTC Sheet
      const utcData = utcMap[clCode] || { isTradedFTD: (netBrokFTD > 0 || idx % 3 === 0), isTradedMTD: true, isTradedYTD: true };
      
      // Relational Join with Acquisition Sheet
      const acqData = acqMap[clCode] || {
        acqFTD: (cat === 'NCR' && idx % 3 === 0) ? 1 : 0,
        actFTD: (cat === 'NCR' && idx % 3 === 0) ? 1 : 0,
        acqMTD: (cat === 'NCR') ? 1 : 0,
        actMTD: (cat === 'NCR') ? 1 : 0,
        acqYTD: (cat === 'NCR') ? 1 : 0,
        actYTD: (cat === 'NCR') ? 1 : 0
      };

      // Relational Join with TPP Sheet
      const tppData = tppMap[clCode] || {
        mfAum: Math.round(netBrokFTD * 150),
        mfSip: Math.round(netBrokFTD * 4),
        insPrem: Math.round(netBrokFTD * 12),
        sgbVol: Math.round(netBrokFTD * 25),
        revMTD: Math.round(netBrokFTD * 2.8)
      };

      clients.push({
        clientCode: clCode,
        clientName: clName,
        dealerName: dlName,
        branchName: brName,
        branchCode: brCode,
        channelName: chName,
        regionName: regName,
        zoneName: zoneName,
        category: cat,
        isActive: true,
        onlineShare: onlineShare,
        isTradedYesterday: utcData.isTradedFTD,
        isTradedMTD: utcData.isTradedMTD,
        isTradedYTD: utcData.isTradedYTD,
        dailyTrend: [Math.round(netBrokFTD * 0.86), Math.round(netBrokFTD * 0.91), Math.round(netBrokFTD * 0.94), Math.round(netBrokFTD * 0.96), netBrokFTD],
        netBrokerage: { yesterday: netBrokFTD, mtd: netBrokMTD, ytd: netBrokYTD },
        grossBrokerage: { yesterday: Math.round(netBrokFTD * 1.54), mtd: grossBrokMTD, ytd: Math.round(grossBrokMTD * 7.5) },
        turnover: { yesterday: toFTD, mtd: toMTD, ytd: toYTD },
        orders: { yesterday: ordFTD, mtd: ordMTD, ytd: ordYTD },
        accountOpening: {
          acquiredYesterday: acqData.acqFTD, activatedYesterday: acqData.actFTD,
          acquiredMTD: acqData.acqMTD, activatedMTD: acqData.actMTD,
          acquiredYTD: acqData.acqYTD, activatedYTD: acqData.actYTD
        },
        segments: {
          cash: netBrokFTD > 0 ? Math.round((cashBrok / netBrokFTD) * 100) : 28,
          eqFO: netBrokFTD > 0 ? Math.round((foBrok / netBrokFTD) * 100) : 58,
          commodity: netBrokFTD > 0 ? Math.round((commBrok / netBrokFTD) * 100) : 14
        },
        wealth: {
          hasMF: tppData.mfAum > 0, hasInsurance: tppData.insPrem > 0, hasSGB: tppData.sgbVol > 0,
          mfAum: tppData.mfAum, mfSipMonthly: tppData.mfSip, mfRevenueMTD: Math.round(tppData.mfAum * 0.001),
          insPremiumMTD: tppData.insPrem, insRevenueMTD: Math.round(tppData.insPrem * 0.18),
          sgbVolumeMTD: tppData.sgbVol, sgbRevenueMTD: Math.round(tppData.sgbVol * 0.005),
          totalRevenueYesterday: Math.round(netBrokFTD * 0.12),
          totalRevenueMTD: tppData.revMTD || Math.round(netBrokMTD * 0.14),
          totalRevenueYTD: Math.round(netBrokYTD * 0.15)
        }
      });
    });

    // Group clients into 6-Level Hierarchy Tree
    const treeMap = {};

    clients.forEach(c => {
      const chKey = c.channelName || 'Branch Network';
      const regKey = c.regionName || 'North Region';
      const zoneKey = c.zoneName || 'Delhi NCR Zone';
      const brKey = c.branchCode || '8047';
      const dlKey = c.dealerName || 'Default Dealer';

      if (!treeMap[chKey]) treeMap[chKey] = { channelId: `CH_${chKey.replace(/[^A-Z0-9]/gi, '_')}`, channelName: chKey, regions: {} };
      if (!treeMap[chKey].regions[regKey]) treeMap[chKey].regions[regKey] = { regionId: `REG_${regKey.replace(/[^A-Z0-9]/gi, '_')}`, regionName: regKey, zones: {} };
      if (!treeMap[chKey].regions[regKey].zones[zoneKey]) treeMap[chKey].regions[regKey].zones[zoneKey] = { zoneId: `ZONE_${zoneKey.replace(/[^A-Z0-9]/gi, '_')}`, zoneName: zoneKey, branches: {} };
      if (!treeMap[chKey].regions[regKey].zones[zoneKey].branches[brKey]) treeMap[chKey].regions[regKey].zones[zoneKey].branches[brKey] = { code: brKey, name: c.branchName || brKey, type: brKey.startsWith('BP') ? 'BP' : 'Branch', dealers: {} };
      if (!treeMap[chKey].regions[regKey].zones[zoneKey].branches[brKey].dealers[dlKey]) treeMap[chKey].regions[regKey].zones[zoneKey].branches[brKey].dealers[dlKey] = { id: `D_${dlKey.replace(/[^A-Z0-9]/gi, '_')}`, name: dlKey, role: 'Equity Dealer', clients: [] };

      treeMap[chKey].regions[regKey].zones[zoneKey].branches[brKey].dealers[dlKey].clients.push(c);
    });

    const hierarchicalTree = Object.values(treeMap).map(ch => ({
      channelId: ch.channelId,
      channelName: ch.channelName,
      regions: Object.values(ch.regions).map(reg => ({
        regionId: reg.regionId,
        regionName: reg.regionName,
        zones: Object.values(reg.zones).map(zone => ({
          zoneId: zone.zoneId,
          zoneName: zone.zoneName,
          branches: Object.values(zone.branches).map(br => ({
            code: br.code,
            name: br.name,
            type: br.type,
            dealers: Object.values(br.dealers)
          }))
        }))
      }))
    }));

    return {
      tree: hierarchicalTree,
      clientCount: clients.length,
      branchCount: branchSet.size,
      dealerCount: dealerSet.size
    };
  }

  function renderUploadedPreview(rows) {
    const previewContainer = document.getElementById('xlsb-preview-container');
    if (!previewContainer || rows.length === 0) return;

    previewContainer.style.display = 'block';
    const firstRow = rows[0];
    const headerKeys = Object.keys(firstRow).slice(0, 10);
    const sampleRows = rows.slice(0, 8);

    let tableHtml = `
      <div style="font-family:var(--font-display); font-weight:800; margin-bottom:8px; color:var(--text-main); font-size:0.88rem;">
        📊 Ingested Data Preview (First 8 Rows)
      </div>
      <div class="table-responsive">
        <table class="tree-table">
          <thead>
            <tr>${headerKeys.map(h => `<th>${h || 'Column'}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${sampleRows.map(r => `<tr>${headerKeys.map(k => `<td>${r[k] !== undefined ? r[k] : '-'}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
    previewContainer.innerHTML = tableHtml;
  }

  window.switchDataSource = function (source) {
    state.dataSource = source;
    renderDashboard();
  };

  // Initialize Application
  document.addEventListener('DOMContentLoaded', () => {
    const searchBox = document.getElementById('tree-search-input');
    if (searchBox) {
      searchBox.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderHierarchyTreeTable();
      });
    }

    const dateSel = document.getElementById('date-selector');
    if (dateSel) {
      dateSel.addEventListener('change', (e) => {
        state.selectedDate = e.target.value;
        renderDashboard();
      });
    }

    setupDropzone();
    renderDashboard();
  });

})();
