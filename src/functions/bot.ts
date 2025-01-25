import { Asset } from "../models";

const ETH_ID =
  "0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07";

export const getBotData = async (
  asset_0: string,
  asset_1: string,
  tx: any,
  id: any
) => {
  if (asset_0 === ETH_ID) {
    const eth_in = tx.asset_0_in;
    const asset_out = tx.asset_1_out;

    const asset_bought = await Asset.findByPk(asset_1, {
      attributes: ["asset_id", "name", "symbol", "decimals", "icon"],
    });

    return {
      eth_in,
      asset_out,
      asset_bought,
      trx_hash: id,
    };
  } else if (asset_1 === ETH_ID) {
    const eth_in = tx.asset_1_in / 10 ** 9;
    console.log(eth_in);

    const asset_bought = await Asset.findByPk(asset_0, {
      attributes: ["asset_id", "name", "symbol", "decimals", "icon"],
    });

    const asset_out = tx.asset_0_out / 10 ** asset_bought?.decimals!;

    return {
      eth_in,
      asset_out,
      asset_bought,
      trx_hash: id,
    };
  }
};
