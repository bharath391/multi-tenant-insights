import sgMail from "@sendgrid/mail";
import "dotenv/config";
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const sendMail = async (mail, otp) => {
    try {
        const msg = {
            to: mail, // Change to your recipient
            from: 'mrbharathyadav33@gmail.com', // Change to your verified sender
            text: `Your otp for multi-tenant-insights : ${otp}`,
            subject: 'Multi-Tenant-Insights Login/SingUp',
        };
        sgMail
            .send(msg)
            .then(() => {
            return 1; //successfully sent otp
        })
            .catch((error) => {
            throw (error);
        });
        return 1;
    }
    catch (e) {
        console.log("Error sending mail/otp via sendGrid : ", e);
        return 0; //fail
    }
};
export default sendMail;
//# sourceMappingURL=sendgrid.js.map