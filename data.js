/**
 * Religare Broking Executive Intelligence - Enterprise Hierarchical Dataset & Metrics Engine
 * 
 * Dimensions:
 * - Time Filter: FTD (For The Day / Yesterday), MTD (Month Till Date), YTD (Year Till Date)
 * - Persistent Master KPIs: Net Brokerage, UTC, Account Opening
 * - Client Categories: NCR, PCR, OCR + Cohort Traded Counts & ARPU (Average Revenue Per User)
 * - Channel-wise Revenue Mix: Branch Network, BP Franchisee, Direct/Delta Digital
 * - Last 5 Days Revenue & UTC Trend (Historical Performance)
 * - Trade Segments: Cash, Eq-F&O, Commodity
 * - Modewise: Online vs Offline
 * - Wealth: Mutual Funds, Insurance, SGB/Bonds
 */

window.RELIGARE_DATA = (function () {
  
  function generateClients(count, prefix, dealerName, branchName, branchCode, channelId) {
    const clients = [];
    const firstNames = ['Rajesh', 'Sunita', 'Anil', 'Meena', 'Suresh', 'Pooja', 'Ramesh', 'Kavita', 'Vikas', 'Deepa', 'Manoj', 'Ritu', 'Alok', 'Sneha', 'Gaurav', 'Anita', 'Naveen', 'Swati', 'Harish', 'Preeti'];
    const lastNames = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Mehta', 'Agarwal', 'Jain', 'Saxena', 'Kumar', 'Kapoor', 'Patel', 'Shah', 'Iyer', 'Reddy', 'Deshmukh', 'Chopra', 'Malhotra', 'Bhatia', 'Ghosh', 'Sen'];

    for (let i = 1; i <= count; i++) {
      const fn = firstNames[(i * 3 + prefix.charCodeAt(0)) % firstNames.length];
      const ln = lastNames[(i * 5 + prefix.charCodeAt(1)) % lastNames.length];
      const clientCode = `REL${prefix}${1000 + i}`;

      let acqPeriod = 'priorFY';
      if (i % 10 === 0 || i % 17 === 0) {
        acqPeriod = 'thisFY';
      } else if (i % 5 === 0 || i % 7 === 0) {
        acqPeriod = 'prevFY';
      }

      const isTradedYesterday = (i % 3 === 0 || i % 7 === 0);
      const isTradedMTD = isTradedYesterday || (i % 2 === 0 || i % 5 === 0);
      const isTradedYTD = isTradedMTD || (i % 4 !== 0);

      let category = 'OCR';
      if (acqPeriod === 'thisFY') {
        category = 'NCR';
      } else if (acqPeriod === 'prevFY') {
        category = 'PCR';
      } else {
        category = 'OCR';
      }

      const isActive = i % 4 !== 0;
      const onlineShare = (i % 6 === 0) ? (20 + (i * 5) % 30) : (70 + (i * 3) % 28);

      // Net Brokerage
      const netBrokYesterday = isTradedYesterday ? Math.round(450 + (i * 123) % 4500) : 0;
      const netBrokMTD = isTradedMTD ? Math.round(netBrokYesterday * 18 + (i * 456) % 35000 + 1200) : 0;
      const netBrokYTD = isTradedYTD ? Math.round(netBrokMTD * 7.5 + (i * 987) % 250000 + 15000) : 0;

      // Gross Brokerage
      const grossBrokYesterday = Math.round(netBrokYesterday * 1.52);
      const grossBrokMTD = Math.round(netBrokMTD * 1.54);
      const grossBrokYTD = Math.round(netBrokYTD * 1.53);

      // Turnover
      const turnoverYesterday = isTradedYesterday ? Math.round(netBrokYesterday * 1450 + (i * 789) % 2500000) : 0;
      const turnoverMTD = Math.round(turnoverYesterday * 19 + (i * 321) % 45000000 + 500000);
      const turnoverYTD = Math.round(turnoverMTD * 7.8 + (i * 654) % 350000000 + 5000000);

      // Orders count
      const ordersYesterday = isTradedYesterday ? Math.max(1, Math.round(netBrokYesterday / 120) + (i % 4)) : 0;
      const ordersMTD = isTradedMTD ? Math.round(ordersYesterday * 18 + (i % 15) + 3) : 0;
      const ordersYTD = isTradedYTD ? Math.round(ordersMTD * 7.6 + (i % 40) + 12) : 0;

      // 5-Day Historical Daily Brokerage (D-4 to D-0)
      const day4 = isTradedYesterday ? Math.round(netBrokYesterday * 0.86) : 0;
      const day3 = isTradedYesterday ? Math.round(netBrokYesterday * 0.91) : 0;
      const day2 = isTradedYesterday ? Math.round(netBrokYesterday * 0.94) : 0;
      const day1 = isTradedYesterday ? Math.round(netBrokYesterday * 0.96) : 0;
      const day0 = netBrokYesterday;

      // Account Opening
      const isAcquiredYesterday = (acqPeriod === 'thisFY' && (i === 1 || i % 23 === 0));
      const isAcquiredMTD = acqPeriod === 'thisFY' && (isAcquiredYesterday || i % 6 === 0);
      const isAcquiredYTD = (acqPeriod === 'thisFY');
      const isActivated = isActive;

      // Segments
      const cashPct = 25 + (i * 3) % 20;
      const foPct = 45 + (i * 4) % 25;
      const commPct = 100 - cashPct - foPct;

      // Wealth Products
      const hasMF = (i % 2 === 0);
      const hasInsurance = (i % 4 === 0);
      const hasSGB = (i % 6 === 0);

      const mfAum = hasMF ? (50000 + (i * 23456) % 1500000) : 0;
      const mfSipMonthly = hasMF ? (2000 + (i * 1000) % 25000) : 0;
      const mfRevenueMTD = hasMF ? Math.round(mfAum * 0.0008 + mfSipMonthly * 0.015) : 0;

      const insPremiumMTD = hasInsurance ? (15000 + (i * 8765) % 120000) : 0;
      const insRevenueMTD = hasInsurance ? Math.round(insPremiumMTD * 0.18) : 0;

      const sgbVolumeMTD = hasSGB ? (25000 + (i * 5432) % 200000) : 0;
      const sgbRevenueMTD = hasSGB ? Math.round(sgbVolumeMTD * 0.005) : 0;

      clients.push({
        clientCode,
        clientName: `${fn} ${ln}`,
        dealerName,
        branchName,
        branchCode,
        channelId,
        category,
        acqPeriod,
        isActive,
        onlineShare,
        isTradedYesterday,
        isTradedMTD,
        isTradedYTD,
        dailyTrend: [day4, day3, day2, day1, day0],
        netBrokerage: {
          yesterday: netBrokYesterday,
          mtd: netBrokMTD,
          ytd: netBrokYTD
        },
        grossBrokerage: {
          yesterday: grossBrokYesterday,
          mtd: grossBrokMTD,
          ytd: grossBrokYTD
        },
        turnover: {
          yesterday: turnoverYesterday,
          mtd: turnoverMTD,
          ytd: turnoverYTD
        },
        orders: {
          yesterday: ordersYesterday,
          mtd: ordersMTD,
          ytd: ordersYTD
        },
        accountOpening: {
          acquiredYesterday: isAcquiredYesterday ? 1 : 0,
          activatedYesterday: (isAcquiredYesterday && isActivated) ? 1 : 0,
          acquiredMTD: isAcquiredMTD ? 1 : 0,
          activatedMTD: (isAcquiredMTD && isActivated) ? 1 : 0,
          acquiredYTD: isAcquiredYTD ? 1 : 0,
          activatedYTD: (isAcquiredYTD && isActivated) ? 1 : 0
        },
        segments: {
          cash: Math.max(10, cashPct),
          eqFO: Math.max(30, foPct),
          commodity: Math.max(5, commPct)
        },
        wealth: {
          hasMF,
          hasInsurance,
          hasSGB,
          mfAum,
          mfSipMonthly,
          mfRevenueMTD,
          insPremiumMTD,
          insRevenueMTD,
          sgbVolumeMTD,
          sgbRevenueMTD,
          totalRevenueYesterday: Math.round((mfRevenueMTD + insRevenueMTD + sgbRevenueMTD) / 22),
          totalRevenueMTD: mfRevenueMTD + insRevenueMTD + sgbRevenueMTD,
          totalRevenueYTD: Math.round((mfRevenueMTD + insRevenueMTD + sgbRevenueMTD) * 7.2)
        }
      });
    }
    return clients;
  }

  // Define 6-Level Hierarchy Tree
  const hierarchyTree = [
    {
      channelId: 'CH_BRANCH',
      channelName: 'Branch Network (Retail)',
      type: 'Branch',
      regions: [
        {
          regionId: 'REG_NORTH',
          regionName: 'North Region',
          head: 'Rajeev Singhania',
          zones: [
            {
              zoneId: 'ZONE_DELHI_NCR',
              zoneName: 'Delhi NCR Zone',
              head: 'Siddharth Mehra',
              branches: [
                {
                  code: '8047',
                  name: 'CP Branch',
                  type: 'Branch',
                  manager: 'Vivek Oberoi',
                  dealers: [
                    { id: 'D101', name: 'Amit Sharma', role: 'Sr. Equity Dealer', clients: generateClients(28, 'CP1', 'Amit Sharma', 'CP Branch', '8047', 'CH_BRANCH') },
                    { id: 'D102', name: 'Priya Gupta', role: 'Derivative Specialist', clients: generateClients(24, 'CP2', 'Priya Gupta', 'CP Branch', '8047', 'CH_BRANCH') },
                    { id: 'D103', name: 'Vikram Singh', role: 'Commodity & FX Dealer', clients: generateClients(20, 'CP3', 'Vikram Singh', 'CP Branch', '8047', 'CH_BRANCH') }
                  ]
                },
                {
                  code: '8048',
                  name: 'Karol Bagh Branch',
                  type: 'Branch',
                  manager: 'Anand Goel',
                  dealers: [
                    { id: 'D104', name: 'Neha Verma', role: 'Sr. Equity Dealer', clients: generateClients(22, 'KB1', 'Neha Verma', 'Karol Bagh Branch', '8048', 'CH_BRANCH') },
                    { id: 'D105', name: 'Rahul Jain', role: 'Equity & F&O Dealer', clients: generateClients(20, 'KB2', 'Rahul Jain', 'Karol Bagh Branch', '8048', 'CH_BRANCH') }
                  ]
                },
                {
                  code: '8049',
                  name: 'Nehru Place Branch',
                  type: 'Branch',
                  manager: 'Sunil Mathur',
                  dealers: [
                    { id: 'D106', name: 'Deepak Kumar', role: 'HNI Wealth Dealer', clients: generateClients(26, 'NP1', 'Deepak Kumar', 'Nehru Place Branch', '8049', 'CH_BRANCH') }
                  ]
                },
                {
                  code: '8050',
                  name: 'GK Branch',
                  type: 'Branch',
                  manager: 'Harish Bajaj',
                  dealers: [
                    { id: 'D108', name: 'Kavita Rao', role: 'Sr. Wealth Dealer', clients: generateClients(25, 'GK1', 'Kavita Rao', 'GK Branch', '8050', 'CH_BRANCH') }
                  ]
                }
              ]
            },
            {
              zoneId: 'ZONE_PUNJAB',
              zoneName: 'Punjab Zone',
              head: 'Manpreet Singh',
              branches: [
                {
                  code: '8055',
                  name: 'Ludhiana Main Branch',
                  type: 'Branch',
                  manager: 'Jaswinder Kaur',
                  dealers: [
                    { id: 'D110', name: 'Gurpreet Singh', role: 'Equity Dealer', clients: generateClients(24, 'LD1', 'Gurpreet Singh', 'Ludhiana Main Branch', '8055', 'CH_BRANCH') }
                  ]
                }
              ]
            }
          ]
        },
        {
          regionId: 'REG_WEST',
          regionName: 'West Region',
          head: 'Devendra Kulkarni',
          zones: [
            {
              zoneId: 'ZONE_MUMBAI',
              zoneName: 'Mumbai Zone',
              head: 'Ketan Parikh',
              branches: [
                {
                  code: '8011',
                  name: 'Nariman Point Branch',
                  type: 'Branch',
                  manager: 'Nilesh Vora',
                  dealers: [
                    { id: 'D120', name: 'Ashwin Merchant', role: 'Institutional Dealer', clients: generateClients(32, 'NPB1', 'Ashwin Merchant', 'Nariman Point Branch', '8011', 'CH_BRANCH') },
                    { id: 'D121', name: 'Bhavna Kothari', role: 'HNI Derivative Specialist', clients: generateClients(30, 'NPB2', 'Bhavna Kothari', 'Nariman Point Branch', '8011', 'CH_BRANCH') }
                  ]
                },
                {
                  code: '8012',
                  name: 'Fort Branch',
                  type: 'Branch',
                  manager: 'Dinesh Somani',
                  dealers: [
                    { id: 'D123', name: 'Kiran Desai', role: 'Equity Dealer', clients: generateClients(25, 'FT1', 'Kiran Desai', 'Fort Branch', '8012', 'CH_BRANCH') }
                  ]
                }
              ]
            }
          ]
        },
        {
          regionId: 'REG_SOUTH',
          regionName: 'South Region',
          head: 'Venkatesh Raman',
          zones: [
            {
              zoneId: 'ZONE_BANGALORE',
              zoneName: 'Bangalore Zone',
              head: 'Karthik Sundaram',
              branches: [
                {
                  code: '8071',
                  name: 'MG Road Branch',
                  type: 'Branch',
                  manager: 'Naveen Kumar',
                  dealers: [
                    { id: 'D140', name: 'Arjun Rao', role: 'Tech HNI Equity Dealer', clients: generateClients(28, 'MG1', 'Arjun Rao', 'MG Road Branch', '8071', 'CH_BRANCH') }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      channelId: 'CH_FRANCHISEE',
      channelName: 'BP Franchisee (Business Partners)',
      type: 'BP',
      regions: [
        {
          regionId: 'REG_NORTH_BP',
          regionName: 'North Region (BP)',
          head: 'Rajeev Singhania',
          zones: [
            {
              zoneId: 'ZONE_DELHI_BP',
              zoneName: 'Delhi NCR Zone (BP)',
              head: 'Kapil Chawla',
              branches: [
                {
                  code: 'BP101',
                  name: 'Om Capital Securities',
                  type: 'BP',
                  manager: 'Om Prakash Aggarwal',
                  dealers: [
                    { id: 'BP_D1', name: 'Rohan Aggarwal', role: 'BP Sub-Broker Lead', clients: generateClients(35, 'BPOM1', 'Rohan Aggarwal', 'Om Capital Securities', 'BP101', 'CH_FRANCHISEE') }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      channelId: 'CH_DELTA',
      channelName: 'Direct / Delta (Digital App)',
      type: 'Direct',
      regions: [
        {
          regionId: 'REG_DIGITAL_NATIONAL',
          regionName: 'Religare Dynami Digital App',
          head: 'Abhishek Singhal',
          zones: [
            {
              zoneId: 'ZONE_DIGITAL_IN',
              zoneName: 'All India App Direct Desk',
              head: 'Pooja Bhattacharya',
              branches: [
                {
                  code: 'DIG901',
                  name: 'Dynami Online Trading Desk',
                  type: 'Direct',
                  manager: 'Rohan Sengupta',
                  dealers: [
                    { id: 'DIG_D1', name: 'Digital Algorithmic Desk', role: 'Automated / Direct API', clients: generateClients(60, 'DGT1', 'Digital Algorithmic Desk', 'Dynami Online Trading Desk', 'DIG901', 'CH_DELTA') },
                    { id: 'DIG_D2', name: 'Mobile App Self-Trade Desk', role: 'Mobile Retail Desk', clients: generateClients(65, 'DGT2', 'Mobile App Self-Trade Desk', 'Dynami Online Trading Desk', 'DIG901', 'CH_DELTA') }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ];

  function collectClients(node) {
    let clients = [];
    if (!node) return clients;

    if (node.clients && Array.isArray(node.clients)) return node.clients;
    if (node.dealers && Array.isArray(node.dealers)) {
      node.dealers.forEach(d => { clients = clients.concat(collectClients(d)); });
      return clients;
    }
    if (node.branches && Array.isArray(node.branches)) {
      node.branches.forEach(b => { clients = clients.concat(collectClients(b)); });
      return clients;
    }
    if (node.zones && Array.isArray(node.zones)) {
      node.zones.forEach(z => { clients = clients.concat(collectClients(z)); });
      return clients;
    }
    if (node.regions && Array.isArray(node.regions)) {
      node.regions.forEach(r => { clients = clients.concat(collectClients(r)); });
      return clients;
    }
    if (Array.isArray(node)) {
      node.forEach(item => { clients = clients.concat(collectClients(item)); });
      return clients;
    }
    return clients;
  }

  function calculateMetrics(clients) {
    const totalMapped = clients.length;
    let activeClients = 0;
    let dormantClients = 0;

    let tradedYesterdayCount = 0, tradedMTDCount = 0, tradedYTDCount = 0;

    let netBrokYesterday = 0, netBrokMTD = 0, netBrokYTD = 0;
    let grossBrokYesterday = 0, grossBrokMTD = 0, grossBrokYTD = 0;
    let turnoverYesterday = 0, turnoverMTD = 0, turnoverYTD = 0;
    let ordersYesterday = 0, ordersMTD = 0, ordersYTD = 0;

    let acqYesterday = 0, actYesterday = 0;
    let acqMTD = 0, actMTD = 0;
    let acqYTD = 0, actYTD = 0;

    // NCR / PCR / OCR Breakdown with Active Traded Counts
    let ncrClients = 0, pcrClients = 0, ocrClients = 0;
    let ncrTradedYest = 0, ncrTradedMTD = 0, ncrTradedYTD = 0;
    let pcrTradedYest = 0, pcrTradedMTD = 0, pcrTradedYTD = 0;
    let ocrTradedYest = 0, ocrTradedMTD = 0, ocrTradedYTD = 0;

    let ncrBrokYest = 0, ncrBrokMTD = 0, ncrBrokYTD = 0;
    let pcrBrokYest = 0, pcrBrokMTD = 0, pcrBrokYTD = 0;
    let ocrBrokYest = 0, ocrBrokMTD = 0, ocrBrokYTD = 0;

    // Channel-wise Revenue & UTC Mix
    const channelStats = {
      CH_BRANCH: { name: 'Branch Network (Retail)', ftd: 0, mtd: 0, ytd: 0, utcFTD: 0, utcMTD: 0, utcYTD: 0 },
      CH_FRANCHISEE: { name: 'BP Franchisee', ftd: 0, mtd: 0, ytd: 0, utcFTD: 0, utcMTD: 0, utcYTD: 0 },
      CH_DELTA: { name: 'Direct / Delta App', ftd: 0, mtd: 0, ytd: 0, utcFTD: 0, utcMTD: 0, utcYTD: 0 }
    };

    // 5-Day Revenue & UTC Trend totals
    const dailyTrendTotals = [0, 0, 0, 0, 0];
    const dailyUtcTotals = [0, 0, 0, 0, 0];

    // Segments: Cash, Eq-F&O, Commodity
    let cashBrokYest = 0, cashBrokMTD = 0, cashBrokYTD = 0;
    let cashTOYest = 0, cashTOMTD = 0, cashTOYTD = 0;
    let cashOrdYest = 0, cashOrdMTD = 0, cashOrdYTD = 0;

    let foBrokYest = 0, foBrokMTD = 0, foBrokYTD = 0;
    let foTOYest = 0, foTOMTD = 0, foTOYTD = 0;
    let foOrdYest = 0, foOrdMTD = 0, foOrdYTD = 0;

    let commBrokYest = 0, commBrokMTD = 0, commBrokYTD = 0;
    let commTOYest = 0, commTOMTD = 0, commTOYTD = 0;
    let commOrdYest = 0, commOrdMTD = 0, commOrdYTD = 0;

    // Modewise: Online vs Offline
    let onBrokYest = 0, onBrokMTD = 0, onBrokYTD = 0;
    let onTOYest = 0, onTOMTD = 0, onTOYTD = 0;
    let onOrdYest = 0, onOrdMTD = 0, onOrdYTD = 0;

    let offBrokYest = 0, offBrokMTD = 0, offBrokYTD = 0;
    let offTOYest = 0, offTOMTD = 0, offTOYTD = 0;
    let offOrdYest = 0, offOrdMTD = 0, offOrdYTD = 0;

    // Wealth
    let mfAumTotal = 0, mfSipTotal = 0, mfRevMTD = 0;
    let insPremMTD = 0, insRevMTD = 0;
    let sgbVolMTD = 0, sgbRevMTD = 0;
    let wealthRevYest = 0, wealthRevMTD = 0, wealthRevYTD = 0;

    clients.forEach(c => {
      if (c.isActive) activeClients++;
      else dormantClients++;

      if (c.isTradedYesterday) tradedYesterdayCount++;
      if (c.isTradedMTD) tradedMTDCount++;
      if (c.isTradedYTD) tradedYTDCount++;

      netBrokYesterday += c.netBrokerage.yesterday;
      netBrokMTD += c.netBrokerage.mtd;
      netBrokYTD += c.netBrokerage.ytd;

      grossBrokYesterday += c.grossBrokerage.yesterday;
      grossBrokMTD += c.grossBrokerage.mtd;
      grossBrokYTD += c.grossBrokerage.ytd;

      turnoverYesterday += c.turnover.yesterday;
      turnoverMTD += c.turnover.mtd;
      turnoverYTD += c.turnover.ytd;

      ordersYesterday += c.orders.yesterday;
      ordersMTD += c.orders.mtd;
      ordersYTD += c.orders.ytd;

      acqYesterday += c.accountOpening.acquiredYesterday;
      actYesterday += c.accountOpening.activatedYesterday;
      acqMTD += c.accountOpening.acquiredMTD;
      actMTD += c.accountOpening.activatedMTD;
      acqYTD += c.accountOpening.acquiredYTD;
      actYTD += c.accountOpening.activatedYTD;

      // 5-Day Trend Rollup
      if (c.dailyTrend && c.dailyTrend.length === 5) {
        for (let d = 0; d < 5; d++) {
          dailyTrendTotals[d] += c.dailyTrend[d];
          if (c.dailyTrend[d] > 0) dailyUtcTotals[d]++;
        }
      }

      // Channel-wise Rollup
      const chId = c.channelId || 'CH_BRANCH';
      if (channelStats[chId]) {
        channelStats[chId].ftd += c.netBrokerage.yesterday;
        channelStats[chId].mtd += c.netBrokerage.mtd;
        channelStats[chId].ytd += c.netBrokerage.ytd;
        if (c.isTradedYesterday) channelStats[chId].utcFTD++;
        if (c.isTradedMTD) channelStats[chId].utcMTD++;
        if (c.isTradedYTD) channelStats[chId].utcYTD++;
      }

      // NCR, PCR, OCR Breakdown & Traded User Counts
      if (c.category === 'NCR') {
        ncrClients++;
        ncrBrokYest += c.netBrokerage.yesterday;
        ncrBrokMTD += c.netBrokerage.mtd;
        ncrBrokYTD += c.netBrokerage.ytd;
        if (c.isTradedYesterday) ncrTradedYest++;
        if (c.isTradedMTD) ncrTradedMTD++;
        if (c.isTradedYTD) ncrTradedYTD++;
      } else if (c.category === 'PCR') {
        pcrClients++;
        pcrBrokYest += c.netBrokerage.yesterday;
        pcrBrokMTD += c.netBrokerage.mtd;
        pcrBrokYTD += c.netBrokerage.ytd;
        if (c.isTradedYesterday) pcrTradedYest++;
        if (c.isTradedMTD) pcrTradedMTD++;
        if (c.isTradedYTD) pcrTradedYTD++;
      } else {
        ocrClients++;
        ocrBrokYest += c.netBrokerage.yesterday;
        ocrBrokMTD += c.netBrokerage.mtd;
        ocrBrokYTD += c.netBrokerage.ytd;
        if (c.isTradedYesterday) ocrTradedYest++;
        if (c.isTradedMTD) ocrTradedMTD++;
        if (c.isTradedYTD) ocrTradedYTD++;
      }

      // Segments
      const cCashW = c.segments.cash / 100;
      const cFoW = c.segments.eqFO / 100;
      const cCommW = c.segments.commodity / 100;

      cashBrokYest += Math.round(c.netBrokerage.yesterday * cCashW);
      cashBrokMTD += Math.round(c.netBrokerage.mtd * cCashW);
      cashBrokYTD += Math.round(c.netBrokerage.ytd * cCashW);
      cashTOYest += Math.round(c.turnover.yesterday * cCashW);
      cashTOMTD += Math.round(c.turnover.mtd * cCashW);
      cashTOYTD += Math.round(c.turnover.ytd * cCashW);
      cashOrdYest += Math.round(c.orders.yesterday * cCashW);
      cashOrdMTD += Math.round(c.orders.mtd * cCashW);
      cashOrdYTD += Math.round(c.orders.ytd * cCashW);

      foBrokYest += Math.round(c.netBrokerage.yesterday * cFoW);
      foBrokMTD += Math.round(c.netBrokerage.mtd * cFoW);
      foBrokYTD += Math.round(c.netBrokerage.ytd * cFoW);
      foTOYest += Math.round(c.turnover.yesterday * cFoW);
      foTOMTD += Math.round(c.turnover.mtd * cFoW);
      foTOYTD += Math.round(c.turnover.ytd * cFoW);
      foOrdYest += Math.round(c.orders.yesterday * cFoW);
      foOrdMTD += Math.round(c.orders.mtd * cFoW);
      foOrdYTD += Math.round(c.orders.ytd * cFoW);

      commBrokYest += Math.round(c.netBrokerage.yesterday * cCommW);
      commBrokMTD += Math.round(c.netBrokerage.mtd * cCommW);
      commBrokYTD += Math.round(c.netBrokerage.ytd * cCommW);
      commTOYest += Math.round(c.turnover.yesterday * cCommW);
      commTOMTD += Math.round(c.turnover.mtd * cCommW);
      commTOYTD += Math.round(c.turnover.ytd * cCommW);
      commOrdYest += Math.round(c.orders.yesterday * cCommW);
      commOrdMTD += Math.round(c.orders.mtd * cCommW);
      commOrdYTD += Math.round(c.orders.ytd * cCommW);

      // Modes
      const onRatio = c.onlineShare / 100;
      const offRatio = 1 - onRatio;

      onBrokYest += Math.round(c.netBrokerage.yesterday * onRatio);
      onBrokMTD += Math.round(c.netBrokerage.mtd * onRatio);
      onBrokYTD += Math.round(c.netBrokerage.ytd * onRatio);
      onTOYest += Math.round(c.turnover.yesterday * onRatio);
      onTOMTD += Math.round(c.turnover.mtd * onRatio);
      onTOYTD += Math.round(c.turnover.ytd * onRatio);
      onOrdYest += Math.round(c.orders.yesterday * onRatio);
      onOrdMTD += Math.round(c.orders.mtd * onRatio);
      onOrdYTD += Math.round(c.orders.ytd * onRatio);

      offBrokYest += Math.round(c.netBrokerage.yesterday * offRatio);
      offBrokMTD += Math.round(c.netBrokerage.mtd * offRatio);
      offBrokYTD += Math.round(c.netBrokerage.ytd * offRatio);
      offTOYest += Math.round(c.turnover.yesterday * offRatio);
      offTOMTD += Math.round(c.turnover.mtd * offRatio);
      offTOYTD += Math.round(c.turnover.ytd * offRatio);
      offOrdYest += Math.round(c.orders.yesterday * offRatio);
      offOrdMTD += Math.round(c.orders.mtd * offRatio);
      offOrdYTD += Math.round(c.orders.ytd * offRatio);

      // Wealth
      mfAumTotal += c.wealth.mfAum;
      mfSipTotal += c.wealth.mfSipMonthly;
      mfRevMTD += c.wealth.mfRevenueMTD;
      insPremMTD += c.wealth.insPremiumMTD;
      insRevMTD += c.wealth.insRevenueMTD;
      sgbVolMTD += c.wealth.sgbVolumeMTD;
      sgbRevMTD += c.wealth.sgbRevenueMTD;
      wealthRevYest += c.wealth.totalRevenueYesterday;
      wealthRevMTD += c.wealth.totalRevenueMTD;
      wealthRevYTD += c.wealth.totalRevenueYTD;
    });

    const prevDayNetBrok = Math.round(netBrokYesterday * 0.91);
    const netBrokDailyGrowth = prevDayNetBrok > 0 ? ((netBrokYesterday - prevDayNetBrok) / prevDayNetBrok) * 100 : 11.2;

    const arpuYesterday = tradedYesterdayCount > 0 ? Math.round(netBrokYesterday / tradedYesterdayCount) : 0;
    const arpuMTD = tradedMTDCount > 0 ? Math.round(netBrokMTD / tradedMTDCount) : 0;
    const arpuYTD = tradedYTDCount > 0 ? Math.round(netBrokYTD / tradedYTDCount) : 0;

    // Calculate ARPU for NCR, PCR, OCR
    const ncrArpuFTD = ncrTradedYest > 0 ? Math.round(ncrBrokYest / ncrTradedYest) : 0;
    const ncrArpuMTD = ncrTradedMTD > 0 ? Math.round(ncrBrokMTD / ncrTradedMTD) : 0;
    const ncrArpuYTD = ncrTradedYTD > 0 ? Math.round(ncrBrokYTD / ncrTradedYTD) : 0;

    const pcrArpuFTD = pcrTradedYest > 0 ? Math.round(pcrBrokYest / pcrTradedYest) : 0;
    const pcrArpuMTD = pcrTradedMTD > 0 ? Math.round(pcrBrokMTD / pcrTradedMTD) : 0;
    const pcrArpuYTD = pcrTradedYTD > 0 ? Math.round(pcrBrokYTD / pcrTradedYTD) : 0;

    const ocrArpuFTD = ocrTradedYest > 0 ? Math.round(ocrBrokYest / ocrTradedYest) : 0;
    const ocrArpuMTD = ocrTradedMTD > 0 ? Math.round(ocrBrokMTD / ocrTradedMTD) : 0;
    const ocrArpuYTD = ocrTradedYTD > 0 ? Math.round(ocrBrokYTD / ocrTradedYTD) : 0;

    return {
      totalMapped,
      activeClients,
      dormantClients,
      kpis: {
        netBrokerage: {
          yesterday: netBrokYesterday,
          yesterdayGrowth: Number(netBrokDailyGrowth.toFixed(1)),
          mtd: netBrokMTD,
          mtdGrowth: 12.8,
          ytd: netBrokYTD,
          ytdGrowth: 18.2,
          grossYesterday: grossBrokYesterday,
          grossMTD: grossBrokMTD,
          grossYTD: grossBrokYTD,
          nbGbRatio: grossBrokMTD > 0 ? Math.round((netBrokMTD / grossBrokMTD) * 100) : 65
        },
        uniqueTradedClients: {
          yesterday: tradedYesterdayCount,
          yesterdayPctMapped: totalMapped > 0 ? Number(((tradedYesterdayCount / totalMapped) * 100).toFixed(1)) : 0,
          mtd: tradedMTDCount,
          mtdPctMapped: totalMapped > 0 ? Number(((tradedMTDCount / totalMapped) * 100).toFixed(1)) : 0,
          ytd: tradedYTDCount,
          ytdPctMapped: totalMapped > 0 ? Number(((tradedYTDCount / totalMapped) * 100).toFixed(1)) : 0,
          arpuYesterday,
          arpuMTD,
          arpuYTD
        },
        accountOpening: {
          yesterday: acqYesterday,
          yesterdayActivated: actYesterday,
          yesterdayActivationRate: acqYesterday > 0 ? Math.round((actYesterday / acqYesterday) * 100) : 75,
          mtd: acqMTD,
          mtdActivated: actMTD,
          mtdActivationRate: acqMTD > 0 ? Math.round((actMTD / acqMTD) * 100) : 78,
          ytd: acqYTD,
          ytdActivated: actYTD,
          ytdActivationRate: acqYTD > 0 ? Math.round((actYTD / acqYTD) * 100) : 80
        }
      },
      ncrPcrOcr: {
        ncr: {
          name: 'NCR (New This FY)',
          clients: ncrClients,
          ftd: ncrBrokYest,
          mtd: ncrBrokMTD,
          ytd: ncrBrokYTD,
          utc: { ftd: ncrTradedYest, mtd: ncrTradedMTD, ytd: ncrTradedYTD },
          arpu: { ftd: ncrArpuFTD, mtd: ncrArpuMTD, ytd: ncrArpuYTD }
        },
        pcr: {
          name: 'PCR (Prev FY)',
          clients: pcrClients,
          ftd: pcrBrokYest,
          mtd: pcrBrokMTD,
          ytd: pcrBrokYTD,
          utc: { ftd: pcrTradedYest, mtd: pcrTradedMTD, ytd: pcrTradedYTD },
          arpu: { ftd: pcrArpuFTD, mtd: pcrArpuMTD, ytd: pcrArpuYTD }
        },
        ocr: {
          name: 'OCR (Vintage Prior FY)',
          clients: ocrClients,
          ftd: ocrBrokYest,
          mtd: ocrBrokMTD,
          ytd: ocrBrokYTD,
          utc: { ftd: ocrTradedYest, mtd: ocrTradedMTD, ytd: ocrTradedYTD },
          arpu: { ftd: ocrArpuFTD, mtd: ocrArpuMTD, ytd: ocrArpuYTD }
        }
      },
      channelRevenueMix: channelStats,
      last5DaysTrend: {
        days: ['21-Aug', '22-Aug', '25-Aug', '26-Aug', '27-Aug (Yest)'],
        revenue: dailyTrendTotals,
        utc: dailyUtcTotals
      },
      tradeSegments: {
        cash: {
          name: 'Cash (Equity)',
          ftd: { brok: cashBrokYest, to: cashTOYest, ord: cashOrdYest },
          mtd: { brok: cashBrokMTD, to: cashTOMTD, ord: cashOrdMTD },
          ytd: { brok: cashBrokYTD, to: cashTOYTD, ord: cashOrdYTD }
        },
        eqFO: {
          name: 'Eq-F&O (Derivatives)',
          ftd: { brok: foBrokYest, to: foTOYest, ord: foOrdYest },
          mtd: { brok: foBrokMTD, to: foTOMTD, ord: foOrdMTD },
          ytd: { brok: foBrokYTD, to: foTOYTD, ord: foOrdYTD }
        },
        commodity: {
          name: 'Commodity (MCX)',
          ftd: { brok: commBrokYest, to: commTOYest, ord: commOrdYest },
          mtd: { brok: commBrokMTD, to: commTOMTD, ord: commOrdMTD },
          ytd: { brok: commBrokYTD, to: commTOYTD, ord: commOrdYTD }
        }
      },
      modewise: {
        online: {
          name: 'Online (App / Web)',
          ftd: { brok: onBrokYest, to: onTOYest, ord: onOrdYest },
          mtd: { brok: onBrokMTD, to: onTOMTD, ord: onOrdMTD },
          ytd: { brok: onBrokYTD, to: onTOYTD, ord: onOrdYTD }
        },
        offline: {
          name: 'Offline (Dealer / Branch)',
          ftd: { brok: offBrokYest, to: offTOYest, ord: offOrdYest },
          mtd: { brok: offBrokMTD, to: offTOMTD, ord: offOrdMTD },
          ytd: { brok: offBrokYTD, to: offTOYTD, ord: offOrdYTD }
        }
      },
      ordersTurnover: {
        orders: { ftd: ordersYesterday, mtd: ordersMTD, ytd: ordersYTD },
        turnover: { ftd: turnoverYesterday, mtd: turnoverMTD, ytd: turnoverYTD }
      },
      wealthProducts: {
        mutualFunds: { aum: mfAumTotal, sipMonthly: mfSipTotal, revMTD: mfRevMTD },
        insurance: { premiumMTD: insPremMTD, revMTD: insRevMTD },
        sgbAndBonds: { volumeMTD: sgbVolMTD, revMTD: sgbRevMTD },
        revenueSummary: { ftd: wealthRevYest, mtd: wealthRevMTD, ytd: wealthRevYTD }
      },
      targets: {
        ftdActual: netBrokYesterday,
        ftdTarget: Math.round(netBrokYesterday * 1.15),
        mtdActual: netBrokMTD,
        mtdTarget: Math.round(netBrokMTD * 1.12),
        ytdActual: netBrokYTD,
        ytdTarget: Math.round(netBrokYTD * 1.18)
      }
    };
  }

  return {
    hierarchyTree,
    collectClients,
    calculateMetrics
  };
})();
