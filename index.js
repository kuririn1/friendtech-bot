import { ethers } from "ethers";
import { config } from 'dotenv';
import fs from "fs";

config();

const url = process.env.WEBSOCKET_URL;
const FOLLOW_NUM = 100;
const contractAddress = '0xCF205808Ed36593aa40a44F10c7f7C2F67d4A4d4';
const contractABI = JSON.parse(fs.readFileSync('contractABI.json', 'utf8'));
const provider = new ethers.WebSocketProvider(url);
const contract = new ethers.Contract(contractAddress, contractABI, provider);

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
        const traderData = await getUserData(trader);
        const subjectData = await getUserData(subject);

        const tradeDetails = {
            ...basicTradeDetails,
            trader: traderData.twitterUsername,
            subject: subjectData.twitterUsername,
        };

        if (await hasFollowers(tradeDetails, FOLLOW_NUM)) {
            console.log(tradeDetails);
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
        const response = await fetch(`https://prod-api.kosetto.com/users/${address}`);
        if (response.ok) {
            return await response.json();
        }
    } catch (err) {
        console.error(`Failed to fetch user data for address ${address}: ${err.message}`);
    }
    return { twitterUsername: address };
}

async function getTwitterFollowersCount(profileName) {
    const myHeaders = new Headers({
        "Authorization": `Bearer ${process.env.TWITTER_TOKEN}`
    });

    const requestOptions = {
        method: 'GET',
        headers: myHeaders,
        redirect: 'follow'
    };

    try {
        const response = await fetch(`https://api.twitter.com/1.1/users/lookup.json?screen_name=${profileName}`, requestOptions);
        if (response.ok) {
            const data = await response.json();
            return data[0].followers_count;
        }
    } catch (err) {
        console.error(`Failed to fetch follow count for ${profileName}: ${err.message}`);
    }
    return 0;
}