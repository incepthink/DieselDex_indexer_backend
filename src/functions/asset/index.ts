import { NextFunction } from "express";
import { Asset } from "../../models";
import { CustomError } from "../../utils/error_factory";
import { AssetType } from "../../types/modelTypes";
import { getValue, storeValue } from "../redis";
import { AssetId, assets, Wallet } from "fuels";
import { ethers } from "ethers";
import { aggregatorV3InterfaceABI } from "../../utils/abis";
import * as cheerio from "cheerio";
import { getContractSupply, initializeProvider, queryDB } from "../../utils";
import { SingleSrc20Asset } from "../../utils/src20";

export const addAsset = async (asset: AssetType, next: NextFunction) => {
  try {
    const toAdd = {
      asset_id: asset.asset_id,
      name: asset.name,
      symbol: asset.symbol,
      decimals: asset.decimals,
      icon: asset.icon,
      l1_address: asset.l1_address,
      contract_id: asset.contract_id,
      subId: asset.subId,
      price_usd: asset.price,
      is_verified: asset.is_verified,
    };

    //@ts-ignore
    const [newAsset, created] = await Asset.findOrCreate({
      where: {
        asset_id: asset.asset_id,
      },
      defaults: toAdd,
    });

    if (!created) {
      newAsset.name = asset.name;
      newAsset.symbol = asset.symbol;
      newAsset.decimals = asset.decimals;
      newAsset.icon = asset.icon;
      newAsset.l1_address = asset.l1_address;
      newAsset.contract_id = asset.contract_id;
      newAsset.subId = asset.subId;
      newAsset.price_usd = asset.price;
      newAsset.is_verified = asset.is_verified;
    }

    newAsset.save();

    return newAsset;
  } catch (error) {
    const statusCode = 500;
    const message = "Failed to getAsset from db";

    return next(
      new CustomError(message, statusCode, { context: "addAsset", error })
    );
  }
};

export const DATA_TTL = 60 * 60 * 24 * 365 * 10;

export async function loadAssetData() {
  console.log(assets);

  await storeValue("fuel_assets", JSON.stringify(assets), DATA_TTL);
  return;
}

export const getPriceFromRedis = async (asset_address: string) => {
  console.log("scrapeAssetPrice::", asset_address);

  try {
    const cachedData = await getValue(`price_${asset_address}`);
    console.log("cachedData::", cachedData);
    if (cachedData) {
      console.log("Returning cached data");
      const data = JSON.parse(cachedData);
      console.log("cached data length", data.length);
      return data;
    }
  } catch (error) {
    console.error("Error reading from cache:", error);
  }

  console.log("Fetching asset price");

  const fuel_assets = await getValue(`fuel_assets`);
  if (!fuel_assets) {
    return { error: "No fuel assets data available" };
  }

  const fuel_asset_data = JSON.parse(fuel_assets);
  const token = fuel_asset_data.find((asset: any) =>
    asset.networks.some((network: any) => {
      console.log(network.assetId);

      return network.type === "fuel" && network.assetId === asset_address;
    })
  );

  console.log("token::", token);

  if (token) {
    if (token.name === "Ethereum") {
      const ethPrice = await getPriceData(
        "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"
      );
      return { priceUSD: Number(ethPrice.formattedPrice) };
    }

    const ethereumNetwork = token.networks.find(
      (network) => network.type === "ethereum" && network.chainId === 1
    );
    const address = ethereumNetwork?.address;
    console.log("eth asset address::", address);

    try {
      let response = await fetch(
        `https://www.coingecko.com/en/coins/${address}`
      );
      let html = await response.text();
      let $ = cheerio.load(html);
      let priceText = $('span[data-converter-target="price"]').first().text();
      console.log("Price", priceText);

      if (!priceText) {
        let formattedName = token.name.replace(/ /g, "-").toLowerCase();
        if (token.name === "SolvBTC.BBN") {
          formattedName = "solv-protocol-solvbtc-bbn";
        }

        response = await fetch(
          `https://www.coingecko.com/en/coins/${formattedName}`
        );
        html = await response.text();
        $ = cheerio.load(html);
        priceText = $('span[data-converter-target="price"]').first().text();
        console.log("Price2", priceText);
      }

      const convertedPrice = parseFloat(priceText.replace(/[$,]/g, ""));
      await storeValue(
        `price_${asset_address}`,
        JSON.stringify({ priceUSD: convertedPrice }),
        10
      ); // 10 sec cache
      return { priceUSD: convertedPrice };
    } catch (error) {
      console.error("Error fetching pairs:", error);
      return { error: "Failed to fetch asset price", token };
    }
  } else {
    return { priceUSD: 1.0 }; // Assume stablecoin if not found
  }
};

export async function getPriceData(address: string) {
  // add in env
  const provider = new ethers.JsonRpcProvider(
    "https://mainnet.infura.io/v3/9e5dc0a1ce85450bbe01670918915271"
  );
  const contract = new ethers.Contract(
    address,
    aggregatorV3InterfaceABI,
    provider
  );
  try {
    //@ts-ignore
    const roundData = await contract.latestRoundData();
    // Convert price to human-readable format (8 decimal places)
    const price = Number(roundData.answer) / 1e8;
    return {
      ...roundData,
      formattedPrice: price.toFixed(2),
    };
  } catch (error) {
    console.error("Error fetching price data:", error);
    throw error;
  }
}

export const getSupply = async (asset_address: string) => {
  console.log("getSupply::", asset_address);
  const query = `
      query MyQuery($asset: String!) {
          BridgeFungibleToken_TotalSupplyEvent(where: {asset: {_eq: $asset}}, limit: 1, order_by: {block_height: desc, time: desc}) {
              supply
          }
      }

  `;

  const variables = {
    asset: asset_address,
  };

  let response: any;
  try {
    response = await queryDB(query, variables);
    console.log(response);
  } catch (error) {
    console.log("Error fetching supply queryDB:", error);
  }

  if (
    asset_address ===
    "0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07"
  ) {
    return { supply: "1100334330272" };
  }

  //find supply elsewhere
  if (!response?.data?.BridgeFungibleToken_TotalSupplyEvent?.[0]) {
    console.log("No supply found------------");

    const provider = await initializeProvider();

    const wallet = Wallet.generate();
    wallet.connect(provider);

    try {
      //USDF
      let contractAddress =
        "0x33a6d90877f12c7954cca6d65587c25e9214c7bed2231c188981c7114c1bdb78";

      //USDF
      if (
        asset_address ===
        "0x33a6d90877f12c7954cca6d65587c25e9214c7bed2231c188981c7114c1bdb78"
      ) {
        contractAddress =
          "0x32deed96558e9572abce544aaf256724aee60517eeb1fabe76e86e4790c888b0";
      }

      const contract = new SingleSrc20Asset(contractAddress, wallet);
      //const contract = new Contract(asset_address, usdfTokenSwayABI, wallet);

      const assetId: AssetId = {
        bits: asset_address,
      };

      // console.log("calling contract1:::");
      // const { supply } = await getContractSupply(
      //   contractAddress,
      //   asset_address
      // );

      // console.log("returned supply::", supply);

      // if (Number(supply) > 0) {
      //   return { supply };
      // }

      //try fuel up contract

      console.log("calling fuel up contract:::");

      contractAddress =
        "0x81d5964bfbb24fd994591cc7d0a4137458d746ac0eb7ececb9a9cf2ae966d942";
      const { supply: fuelUpSupply } = await getContractSupply(
        contractAddress,
        asset_address
      );

      console.log("getSupply supply1:: fup", fuelUpSupply);
      console.log("getSupply supply2::", { supply: fuelUpSupply || "0" });
      return { supply: fuelUpSupply?.toString() || "0" };
    } catch (error) {
      console.log("Try Error fetching supply:", error);
      return { supply: "0" };
    }
  } else {
    console.log(
      "getSupply supply found in db::",
      response.data.BridgeFungibleToken_TotalSupplyEvent?.[0]
    );
    return (
      response.data.BridgeFungibleToken_TotalSupplyEvent?.[0] || { supply: "0" }
    );
  }
};
