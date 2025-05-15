import { AssetId, Provider, Wallet } from "fuels";
import { SingleSrc20Asset } from "./src20";

export async function queryDB(query: string, variables: any) {
  //   if (!process.env.GRAPHQL_URL) {
  //     throw new Error("http://localhost:8080/v1/graphql");
  //   }

  const response = await fetch(
    "https://indexer.dev.hyperindex.xyz/59fa6b1/v1/graphql",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    }
  );

  const data = await response.json();

  return data;
}

let provider: Provider;
export async function initializeProvider() {
  if (!provider) {
    provider = new Provider("https://mainnet.fuel.network/v1/graphql");
  }
  return provider;
}

export const getContractSupply = async (
  contract_address: string,
  asset_address: string
) => {
  const provider = await initializeProvider();

  const wallet = Wallet.generate();
  wallet.connect(provider);

  try {
    //USDF

    const contract = new SingleSrc20Asset(contract_address, wallet);
    //const contract = new Contract(asset_address, usdfTokenSwayABI, wallet);

    const assetId: AssetId = {
      bits: asset_address,
    };

    console.log("calling contract1:::");
    //@ts-ignore
    const { value } = await contract.functions
      .total_supply(assetId)
      .addContracts([contract])
      .get();
    console.log("getSupply supply1::", value);
    console.log("getSupply supply2::", {
      supply: value?.Some?.toString() || "0",
    });
    return { supply: value?.Some?.toString() || "0" };
  } catch (error) {
    console.log("Error fetching supply:", error);

    return { supply: "0" };
  }
};
