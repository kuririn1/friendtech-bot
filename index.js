import { ethers } from "ethers";
import { config } from 'dotenv';
import fs from "fs";
import https from 'https';

config();

const url = process.env.WEBSOCKET_URL;
const FOLLOW_NUM = 10000;
const BUY_PRICE_LIMIT = 3500000000000000n; // in wei
const contractAddress = '0xCF205808Ed36593aa40a44F10c7f7C2F67d4A4d4';
const contractABI = JSON.parse(fs.readFileSync('contractABI.json', 'utf8'));
const provider = new ethers.WebSocketProvider(url);
const contract = new ethers.Contract(contractAddress, contractABI, provider);

const gasPrice = ethers.parseUnits('0.000000000000049431', 'ether');

const privateKey = process.env.PRIVATE_KEY;
const wallet = new ethers.Wallet(privateKey, provider);
const contractWithSigner = contract.connect(wallet);

contract.on('Trade', async (trader, subject, isBuy, shareAmount, ethAmount, protocolEthAmount, subjectEthAmount, supply) => {
    const basicTradeDetails = {
        traderAddress: trader,
        subjectAddress: subject,
        isBuy: isBuy ? "Buy" : "Sell",
        shareAmount,
        ethAmount: ethers.formatEther(ethAmount),
        protocolEthAmount: ethers.formatEther(protocolEthAmount),
        subjectEthAmount: ethers.formatEther(subjectEthAmount),
        supply,
    };

    if (isNewAccount(basicTradeDetails)) {
        const [subjectData] = await Promise.all([getUserData(subject)]);

        const tradeDetails = {
            ...basicTradeDetails,
           // trader: traderData.twitterUsername,
            subject: subjectData.twitterUsername,
        };

        if (await hasFollowers(tradeDetails, FOLLOW_NUM)) {
            console.log(tradeDetails);
            await buyShares(tradeDetails.subjectAddress, 1);
        }
    }
});

function isNewAccount({ traderAddress, subjectAddress, isBuy, ethAmount, shareAmount, supply }) {
    return traderAddress === subjectAddress && isBuy === "Buy" && ethAmount === '0.0' && shareAmount === 1n && supply === 1n;
}

async function hasFollowers({ subject }, followerNumber) {
    if (!subject.startsWith('0x')) {
        const followers = await getTwitterFollowersCount(subject);
        if (followers > followerNumber) {
            console.log(`${subject} has ${followers} followers`);
            return true;
        }
    }
    return false;
}

async function getUserData(address) {
    try {
        const options = {
            hostname: "54.161.4.236",
            path: `/users/${address}`,
        };
        return await performHttpsRequest(options);
    } catch (err) {
        console.error(`Failed to fetch user data for address ${address}: ${err.message}`);
        return { twitterUsername: address };
    }
}

async function getTwitterFollowersCount(profileName) {
    const options = {
        hostname: 'api.twitter.com',
        path: `/1.1/users/lookup.json?screen_name=${profileName}`,
        headers: {
            "Authorization": `Bearer ${process.env.TWITTER_TOKEN}`
        }
    };

    try {
        const data = await performHttpsRequest(options);
        return data[0].followers_count;
    } catch (err) {
        console.error(`Failed to fetch follow count for ${profileName}: ${err.message}`);
        return 0;
    }
}

async function buyShares(subjectAddress, sharesToBuy) {
    const qty = BigInt(sharesToBuy);
    const buyPrice = await contractWithSigner.getBuyPriceAfterFee(subjectAddress, qty);

    console.log(`Buy price: ${buyPrice}`);

    return; // testing to this point

    if(buyPrice >= BUY_PRICE_LIMIT) {
        console.log(`Buy canceled, price too high`);
        return;
    }

    try {
        const tx = await contractWithSigner.buyShares(subjectAddress, qty, { value: buyPrice, gasPrice });
        const receipt = await tx.wait();
        console.log(`Transaction successful with hash: ${receipt.transactionHash}`);
    } catch (err) {
        console.error(`Failed to buy shares for ${subjectAddress}: ${err.message}`);
    }

}

async function performHttpsRequest(options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            ...options,
            rejectUnauthorized: false // Disable SSL verification
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Failed with status: ${res.statusCode}`));
                }
            });
        });

        req.on('error', err => reject(err));
        req.end();
    });
}

process.on('uncaughtException', error => {
    console.error('Uncaught Exception:', error);
});
  
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
});