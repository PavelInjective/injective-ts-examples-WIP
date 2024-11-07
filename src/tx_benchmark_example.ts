import { config } from "dotenv";
import {
  ChainGrpcBankApi,
  IndexerGrpcAccountPortfolioApi,
} from "@injectivelabs/sdk-ts";

import { getNetworkInfo, Network } from '@injectivelabs/networks'

import {
  TxClient,
  PrivateKey,
  TxGrpcClient,
  ChainRestAuthApi,
  createTransaction,
} from '@injectivelabs/sdk-ts'
import { MsgSend } from '@injectivelabs/sdk-ts'
import { BigNumberInBase, DEFAULT_STD_FEE } from '@injectivelabs/utils'


config();



/** Querying Example */
(async () => {
  const chainGrpcBankApi = new ChainGrpcBankApi('https://sentry.chain.grpc-web.injective.network');
  const indexerGrpcAccountPortfolioApi = new IndexerGrpcAccountPortfolioApi(
    'https://sentry.exchange.grpc-web.injective.network'
  );

  const injectiveAddress = "your address";
  const bankBalances = chainGrpcBankApi.fetchBalances(injectiveAddress);

  console.log(bankBalances);

  const portfolio =
    await indexerGrpcAccountPortfolioApi.fetchAccountPortfolioBalances(
      injectiveAddress
    );

  console.log(portfolio);

  const network = getNetworkInfo(Network.Mainnet)

  const privateKeyStr =
    'your key'
  const privateKey = PrivateKey.fromHex(privateKeyStr)
  const publicKey = privateKey.toPublicKey().toBase64()

  /** Account Details **/
  let accountDetails = await new ChainRestAuthApi("https://sentry.lcd.injective.network").fetchAccount(
    injectiveAddress,
  )

  /** Prepare the Message */
  const amount = {
    amount: new BigNumberInBase(0.01).toWei().toFixed(),
    denom: 'inj',
  }

  const msg = MsgSend.fromJSON({
    amount,
    srcInjectiveAddress: injectiveAddress,
    dstInjectiveAddress: injectiveAddress,
  })

  const txService = new TxGrpcClient('https://sentry.chain.grpc-web.injective.network')



  let totalTime = 0;

  for (let i = 0; i < 100; i++) {
    const start = performance.now()
    /** Prepare the Transaction **/
    accountDetails = await new ChainRestAuthApi("https://sentry.lcd.injective.network").fetchAccount(
      injectiveAddress,
    )
    const { signBytes, txRaw } = createTransaction({
      message: msg,
      memo: '',
      fee: DEFAULT_STD_FEE,
      pubKey: publicKey,
      sequence: parseInt(accountDetails.account.base_account.sequence, 10),
      accountNumber: parseInt(
        accountDetails.account.base_account.account_number,
        10,
      ),
      chainId: network.chainId,
    })

    /** Sign transaction */
    const signature = await privateKey.sign(Buffer.from(signBytes))

    /** Append Signatures */
    txRaw.signatures = [signature]

    /** Calculate hash of the transaction */
    console.log(`Transaction Hash: ${TxClient.hash(txRaw)}`)
    /** Simulate transaction */
    try {
      const simulationResponse = await txService.simulate(txRaw)
      console.log(
        `Transaction simulation response: ${JSON.stringify(
          simulationResponse.gasInfo,
        )}`,
      )

      /** Broadcast transaction */
      const txResponse = await txService.broadcast(txRaw)

      if (txResponse.code !== 0) {
        console.log(`Transaction failed: ${txResponse.rawLog}`)
      } else {
        console.log(
          `Broadcasted transaction hash: ${JSON.stringify(txResponse.txHash)}`,
        )
      }
    } catch (e) {
      console.log(e)
    }

    const end = performance.now();
    totalTime += end - start;
  }
  console.log(`${totalTime / 100}`)
})();
