import { subgraphFetch, gql, Big } from './utils.js'

const firstTxBlock = 11480180
const stepBlocks = 100

const genTotalsQuery = (block) => gql`
  {
    totals(id: "", block: { number: ${block} }) {
      totalPooledEther
      totalShares
    }
  }
`

const ratioQuery = gql`
  {
    totalRewards(first: 10000, orderBy: block, orderDirection: asc) {
      block
    }
  }
`

const lastSubmitQuery = gql`
  {
    lidoSubmissions(first: 1, orderBy: block, orderDirection: desc) {
      block
    }
  }
`

// Example USD values from 03.09.2021
const sharesChecks = [
  '17253336101171480', // 70usd
  '453884371982397608502', // 2mil usd
  '22253111414175281724765', // 90mil usd
].map((x) => Big(x))

for (const shares of sharesChecks) {
  console.log('Checking shares:', shares.toString())

  const reports = (await subgraphFetch(ratioQuery)).totalRewards

  const lastBlock = (await subgraphFetch(lastSubmitQuery)).lidoSubmissions.block

  const periods = []

  for (let i = 0; i < reports.length - 1; i++) {
    periods.push({
      start: parseInt(reports[i].block),
      end: parseInt(reports[i + 1].block),
    })
  }

  // Period before first rewards
  periods.unshift({
    start: firstTxBlock,
    end: periods[0].start,
  })

  // Period after last rewards
  periods.push({
    start: periods.at(-1).end,
    end: lastBlock,
  })

  let fluctuationsNumber = 0
  let largestFluctuation = Big(0)
  let totalOfFluctuations = Big(0)

  for (const period of periods) {
    let last = null

    for (let block = period.start; block < period.end; block += stepBlocks) {
      const totals = (await subgraphFetch(genTotalsQuery(block))).totals

      const balance = shares
        .times(totals.totalPooledEther)
        .div(totals.totalShares)

      if (last && !balance.eq(last)) {
        const fluctuation = balance.minus(last).abs()

        totalOfFluctuations = totalOfFluctuations.plus(fluctuation)

        if (fluctuation.gt(largestFluctuation)) {
          largestFluctuation = fluctuation
        }

        fluctuationsNumber++
      }

      last = balance
    }
  }
  console.log('Fluctuations:', fluctuationsNumber)
  console.log('Largest Fluctuation:', largestFluctuation.toNumber())
  console.log('Total Of Fluctuations:', totalOfFluctuations.toNumber())
}
