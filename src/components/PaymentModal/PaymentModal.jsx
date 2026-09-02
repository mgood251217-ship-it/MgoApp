import { useEffect, useState } from "react";
import api from "../../api/axios";
import Modal from "../Modal/Modal";
import Input from "../Input/Input";
import Button from "../Button/Button";
import Icon from "../Icon/Icon";
import { formatRupiah } from "../../services/helpers";
import "./PaymentModal.css";

export default function PaymentModal({ open, onClose, order, onSuccess }) {
    const [nominal, setNominal] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            setNominal("");
            setLoading(false);
        }
    }, [open]);

    const sisaTagihan = (order?.total || 0) - (order?.total_paid || 0);
    const isNominalFilled = Number(nominal) > 0;

    const handlePartialPay = async (payMethod) => {
        if (!isNominalFilled) return;
        setLoading(true);
        try {
            const payload = new FormData();
            payload.append("order_id", order.order_id);
            payload.append("nominal", nominal);
            payload.append("payment_method", payMethod);

            await api.post("", payload, { params: { action: "create_payment" } });
            onSuccess();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleLunas = async (lunasMethod) => {
        setLoading(true);
        try {
            const payload = new FormData();
            payload.append("order_id", order.order_id);
            payload.append("lunas_method", lunasMethod);

            await api.post("", payload, { params: { action: "create_payment" } });
            onSuccess();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={`Pembayaran - ${order?.nomorator || ""}`}
            size="sm"
            headerColor="success"
        >
            <div className="payment-modal-summary">
                <div className="payment-modal-row">
                    <span className="payment-modal-label">Total Tagihan:</span>
                    <span className="payment-modal-value">{formatRupiah(order?.total || 0)}</span>
                </div>
                <div className="payment-modal-row">
                    <span className="payment-modal-label">Sudah Dibayar:</span>
                    <span className="payment-modal-value">{formatRupiah(order?.total_paid || 0)}</span>
                </div>
                <div className="payment-modal-row danger">
                    <span className="payment-modal-label">Sisa Tagihan:</span>
                    <span className="payment-modal-value bold">{formatRupiah(sisaTagihan)}</span>
                </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
                <Input
                    name="nominal"
                    value={nominal}
                    onChange={(e) => setNominal(e.target.value)}
                    type="number"
                    placeholder="Masukkan nominal bayar sebagian..."
                    disabled={loading}
                />
            </div>

            <div className="payment-modal-quick-actions" style={{ marginBottom: "16px" }}>
                <Button
                    size="full-lg"
                    variant="success"
                    icon={<Icon name="payments" />}
                    onClick={() => handleLunas("CASH")}
                    disabled={loading || isNominalFilled}
                    loading={loading && !isNominalFilled}
                >
                    Lunas Cash
                </Button>
                <Button
                    size="full-lg"
                    variant="info"
                    icon={<Icon name="account_balance" />}
                    onClick={() => handleLunas("TF")}
                    disabled={loading || isNominalFilled}
                    loading={loading && !isNominalFilled}
                >
                    Lunas TF
                </Button>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
                <Button
                    size="full-lg"
                    variant="success"
                    icon={<Icon name="add" />}
                    onClick={() => handlePartialPay("CASH")}
                    disabled={loading || !isNominalFilled}
                    loading={loading && isNominalFilled}
                >
                    Sebagian Cash
                </Button>
                <Button
                    size="full-lg"
                    variant="info"
                    icon={<Icon name="add" />}
                    onClick={() => handlePartialPay("TF")}
                    disabled={loading || !isNominalFilled}
                    loading={loading && isNominalFilled}
                >
                    Sebagian TF
                </Button>
            </div>
        </Modal>
    );
}