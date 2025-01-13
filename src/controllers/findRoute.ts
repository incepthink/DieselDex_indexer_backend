import { NextFunction } from "express";
import { CustomError } from "../utils/error_factory";
import { Pool } from "../models";
import { Op } from "sequelize";

const CalcExchnageRate = (pool: Pool, assetId: string) => {
  if (pool.asset_0 === assetId) {
    return Number(pool.reserve_0) / Number(pool.reserve_1);
  } else {
    return Number(pool.reserve_1) / Number(pool.reserve_0);
  }
};

async function checkEthereumRoute(
  sellAssetId: string,
  buyAssetId: string,
  amount: number,
  tradeType: string,
  toSend: any
) {
  // Define Ethereum asset ID (use actual Ethereum token ID here)

  const ethereumAssetId =
    "0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07";

  // Check if there's a pool between sellAssetId and Ethereum
  const sellToEthereumPool = await Pool.findOne({
    where: {
      [Op.or]: [
        { asset_0: sellAssetId, asset_1: ethereumAssetId },
        { asset_0: ethereumAssetId, asset_1: sellAssetId },
      ],
    },
  });

  // Check if there's a pool between buyAssetId and Ethereum
  const buyToEthereumPool = await Pool.findOne({
    where: {
      [Op.or]: [
        { asset_0: buyAssetId, asset_1: ethereumAssetId },
        { asset_0: ethereumAssetId, asset_1: buyAssetId },
      ],
    },
  });

  // If both pools exist, we can route through Ethereum
  if (sellToEthereumPool && buyToEthereumPool) {
    if (tradeType === "ExactInput") {
      console.log("hiiiiiii");

      toSend.input_amount = amount;

      const path0 = [];
      path0.push(sellAssetId, ethereumAssetId, sellToEthereumPool.is_stable);

      let sellToEthExchnageRate = CalcExchnageRate(
        sellToEthereumPool,
        ethereumAssetId
      );
      console.log(sellToEthExchnageRate);

      const output0 = amount * sellToEthExchnageRate; // Amount of eth I will get for the given token
      console.log(output0);

      const path1 = [];
      path1.push(ethereumAssetId, buyAssetId, buyToEthereumPool.is_stable);

      let buyToEthExchangeRate = CalcExchnageRate(
        buyToEthereumPool,
        buyAssetId
      );
      console.log(buyToEthExchangeRate);

      const output1 = output0 * buyToEthExchangeRate; // Amount of required token I will get for that Eth
      console.log(output1);

      toSend.output_amount = output1;

      toSend.path.push(path0, path1);
    } else {
      toSend.output_amount = amount;

      const path0 = [];
      path0.push(buyAssetId, ethereumAssetId, buyToEthereumPool.is_stable);

      let buyToEthExchangeRate = CalcExchnageRate(
        buyToEthereumPool,
        ethereumAssetId
      );
      console.log(buyToEthExchangeRate);

      const output0 = amount * buyToEthExchangeRate; // Amount of eth I will get for the given token
      console.log(output0);

      const path1 = [];
      path1.push(ethereumAssetId, sellAssetId, sellToEthereumPool.is_stable);

      let sellToEthExchnageRate = CalcExchnageRate(
        sellToEthereumPool,
        sellAssetId
      );
      console.log(sellToEthExchnageRate);

      const output1 = output0 * sellToEthExchnageRate; // Amount of required token I will get for that Eth
      console.log(output1);

      toSend.input_amount = output1;

      toSend.path.push(path1, path0);
    }

    return true;
  }

  return null; // No route through Ethereum
}

async function checkUSDCRoute(sellAssetId: string, buyAssetId: string) {
  const path = [];

  const usdcAssetId =
    "0x286c479da40dc953bddc3bb4c453b608bba2e0ac483b077bd475174115395e6b";

  // Check if there's a pool between sellAssetId and USDC
  const sellToUSDCPool = await Pool.findOne({
    where: {
      [Op.or]: [
        { asset_0: sellAssetId, asset_1: usdcAssetId },
        { asset_0: usdcAssetId, asset_1: sellAssetId },
      ],
    },
  });

  // Check if there's a pool between buyAssetId and USDC
  const buyToUSDCPool = await Pool.findOne({
    where: {
      [Op.or]: [
        { asset_0: buyAssetId, asset_1: usdcAssetId },
        { asset_0: usdcAssetId, asset_1: buyAssetId },
      ],
    },
  });

  // If both pools exist, we can route through USDC
  if (sellToUSDCPool && buyToUSDCPool) {
    const path0 = [];
    path0.push(sellAssetId, usdcAssetId, sellToUSDCPool.is_stable);

    const path1 = [];
    path1.push(usdcAssetId, buyAssetId, buyToUSDCPool.is_stable);

    path.push(path0, path1);

    return path;
  }

  return null; // No route through USDC
}

async function checkFuelRoute(sellAssetId: string, buyAssetId: string) {
  const path = [];

  const fuelAssetId =
    "0x1d5d97005e41cae2187a895fd8eab0506111e0e2f3331cd3912c15c24e3c1d82";

  // Check if there's a pool between sellAssetId and Fuel
  const sellToFuelPool = await Pool.findOne({
    where: {
      [Op.or]: [
        { asset_0: sellAssetId, asset_1: fuelAssetId },
        { asset_0: fuelAssetId, asset_1: sellAssetId },
      ],
    },
  });

  // Check if there's a pool between buyAssetId and Fuel
  const buyToFuelPool = await Pool.findOne({
    where: {
      [Op.or]: [
        { asset_0: buyAssetId, asset_1: fuelAssetId },
        { asset_0: fuelAssetId, asset_1: buyAssetId },
      ],
    },
  });

  // If both pools exist, we can route through Fuel
  if (sellToFuelPool && buyToFuelPool) {
    const path0 = [];
    path0.push(sellAssetId, fuelAssetId, sellToFuelPool.is_stable);

    const path1 = [];
    path1.push(fuelAssetId, buyAssetId, buyToFuelPool.is_stable);

    path.push(path0, path1);

    return path;
  }

  return null; // No route through Fuel
}

// const getDirectRoute = async (
//   sellAssetId: string,
//   buyAssetId: string,
//   amount: number,
//   tradeType: string,
//   toSend: any
// ) => {
//   const ethereumAssetId =
//     "0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07";

//   if (sellAssetId === ethereumAssetId) {
//     // Check if there's a pool between sellAssetId and Ethereum
//     const sellToEthereumPool = await Pool.findOne({
//       where: {
//         [Op.or]: [
//           { asset_0: buyAssetId, asset_1: ethereumAssetId },
//           { asset_0: ethereumAssetId, asset_1: buyAssetId },
//         ],
//       },
//     });

//     if (sellToEthereumPool) {
//       const path0 = [];
//       path0.push(buyAssetId, ethereumAssetId, sellToEthereumPool.is_stable);

//       toSend.path.push(path0);
//       return true;
//     }
//   } else if (buyAssetId === ethereumAssetId) {
//     // Check if there's a pool between buyAssetId and Ethereum
//     const buyToEthereumPool = await Pool.findOne({
//       where: {
//         [Op.or]: [
//           { asset_0: sellAssetId, asset_1: ethereumAssetId },
//           { asset_0: ethereumAssetId, asset_1: sellAssetId },
//         ],
//       },
//     });
//     if (buyToEthereumPool) {
//       const path0 = [];
//       path0.push(sellAssetId, ethereumAssetId, buyToEthereumPool.is_stable);

//       toSend.path.push(path0);
//       return true;
//     }
//   }
//   return false;
// };

const getDirectRoute = async (
  sellAssetId: string,
  buyAssetId: string,
  amount: number,
  tradeType: string,
  toSend: any
) => {
  const directPool = await Pool.findOne({
    where: {
      [Op.or]: [
        { asset_0: sellAssetId, asset_1: buyAssetId },
        { asset_0: buyAssetId, asset_1: sellAssetId },
      ],
    },
  });

  console.log(directPool);

  console.log("HISDHSDFJHDFJBSHFIUBF");

  if (directPool) {
    const path0 = [];
    path0.push(directPool.asset_0, directPool.asset_1, directPool.is_stable);

    toSend.path.push(path0);
    return true;
  } else {
    return false;
  }
};

const getSwapRoute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const {
      input: sellAssetId,
      output: buyAssetId,
      amount,
      trade_type: tradeType,
    } = req.body;
    console.log(req.body);

    let routingRoute;

    const toSend = {
      input_amount: 0,
      output_amount: 0,
      path: [],
    };

    routingRoute = await getDirectRoute(
      sellAssetId,
      buyAssetId,
      amount,
      tradeType,
      toSend
    );

    if (routingRoute) {
      return res.status(200).json(toSend);
    }

    routingRoute = await checkEthereumRoute(
      sellAssetId,
      buyAssetId,
      amount,
      tradeType,
      toSend
    );

    if (routingRoute) {
      return res.status(200).json(toSend);
    } else {
      return res.status(404).json({
        error: "no route found",
      });
    }

    if (!routingRoute) {
      console.log("No route through Ethereum, checking for USDC...");
      routingRoute = await checkUSDCRoute(sellAssetId, buyAssetId);
    }

    if (!routingRoute) {
      console.log("No route through USDC, checking for Fuel...");
      routingRoute = await checkFuelRoute(sellAssetId, buyAssetId);
    }

    if (!routingRoute) {
      console.log("No routing path found.");
      return null; // No route found for the tokens
    }
  } catch (error) {
    const statusCode = 500;
    const message = "Failed to get assets";

    return next(
      new CustomError(message, statusCode, { context: "getAssets", error })
    );
  }
};

export { getSwapRoute };
