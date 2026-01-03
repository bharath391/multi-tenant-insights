import sgMail from "@sendgrid/mail";
import "dotenv/config";
import { env } from "./env.js";

sgMail.setApiKey(env("SENDGRID_API_KEY"));

const sendMail = async (to: string, subject: string, html: string) => {
    try {
        const msg = {
            to,
            from: 'mrbharathyadav33@gmail.com', // Change to your verified sender
            subject,
            html,
        }
        await sgMail.send(msg);
        return true;
    } catch (e) {
        console.log("Error sending mail via sendGrid : ", e);
        return false;
    }
}

export const sendRetentionEmail = async (email: string, shopName: string) => {
    const subject = `We Miss You at ${shopName}!`;
    const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>We Miss You!</h2>
            <p>It's been a while since we've seen you at ${shopName}.</p>
            <p>We've updated our collection and would love to have you back.</p>
            <p><strong>Here is a 15% discount code just for you: WELCOMEBACK15</strong></p>
            <br/>
            <p>Best regards,<br/>The ${shopName} Team</p>
        </div>
    `;
    return await sendMail(email, subject, html);
}

export const sendRewardEmail = async (email: string, shopName: string) => {
    const subject = `A Special Gift from ${shopName}!`;
    const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>You're a Star!</h2>
            <p>Thank you for being one of our most loyal customers at ${shopName}.</p>
            <p>To show our appreciation, we're giving you exclusive access to our VIP sale.</p>
            <p><strong>Use code VIP20 for 20% off your next order.</strong></p>
            <br/>
            <p>Best regards,<br/>The ${shopName} Team</p>
        </div>
    `;
    return await sendMail(email, subject, html);
}

export default sendMail;
