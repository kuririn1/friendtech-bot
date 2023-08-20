import { ethers } from "ethers";
import { config } from 'dotenv';
import fs from "fs";

config();

const url = process.env.WEBSOCKET_URL;
const contractAddress = '0xCF205808Ed36593aa40a44F10c7f7C2F67d4A4d4';

const rawdata = fs.readFileSync('contractABI.json', 'utf8');
const contractABI = JSON.parse(rawdata);

const provider = new ethers.WebSocketProvider(url);

const contract = new ethers.Contract(contractAddress, contractABI, provider);

contract.on('Trade', async (trader, subject, isBuy, shareAmount, ethAmount, protocolEthAmount, subjectEthAmount, supply, event) => {
    const boughtSold = (await getUserData(subject)).twitterUsername;
    console.log({
        trader: (await getUserData(trader)).twitterUsername,
        subject: boughtSold,
        isBuy: isBuy ? "Buy" : "Sell",
        shareAmount,
        ethAmount: ethers.formatEther(ethAmount),
        protocolEthAmount: ethers.formatEther(protocolEthAmount),
        subjectEthAmount: ethers.formatEther(subjectEthAmount),
        supply
    });


    if(!boughtSold.startsWith('0x')) {
        const followers = await getTwitterFollowersCount(boughtSold);
        console.log(`${boughtSold} followers: ${followers}}`);
    }
    
});

async function getUserData(address) {
    const url = `https://prod-api.kosetto.com/users/${address}`;

    const response = await fetch(url);

    if (!response.ok) {
        return { twitterUsername: address }; // sometimes it fails to fetch, just just address then
        //throw new Error(`Failed to fetch user data for address ${address}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
}

async function getTwitterFollowersCount(profileName) {
    var myHeaders = new Headers();
    myHeaders.append("Authorization", `Bearer ${process.env.TWITTER_TOKEN}`);

    var requestOptions = {
    method: 'GET',
    headers: myHeaders,
    redirect: 'follow'
    };

    const response = await fetch(`https://api.twitter.com/1.1/users/lookup.json?screen_name=${profileName}`, requestOptions);

    if(!response.ok) {
        console.log(response);
        throw new Error(`Failed to fetch follow count for ${profileName}: ${response.statusText}`);
    }

    const data = await response.json();
    return data[0].followers_count;
}

