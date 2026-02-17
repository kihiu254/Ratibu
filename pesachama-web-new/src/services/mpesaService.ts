import { supabase } from "../lib/supabase";

export const mpesaService = {
    /**
     * Generates an M-Pesa QR code for the specified amount and chama.
     */
    generateQrCode: async (
        amount: number,
        merchantName: string,
        refNo: string,
    ) => {
        try {
            const { data, error } = await supabase.functions.invoke(
                "generate-qr-code",
                {
                    body: {
                        amount,
                        merchantName,
                        refNo,
                        trxCode: "PB", // Default to Paybill
                    },
                },
            );

            if (error) throw error;
            return data;
        } catch (error) {
            console.error("QR Code generation failed:", error);
            throw error;
        }
    },
};
