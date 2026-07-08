import { useEffect, useState } from "react";
import api from "../../api/axios";
import Modal from "../Modal/Modal";
import Form from "../Form/Form";
import Input from "../Input/Input";
import Select from "../Select/Select";
import Button from "../Button/Button";
import Icon from "../Icon/Icon";
import { formatRupiah } from "../../services/helpers";
import "./PaymentModal.css";

export default function PaymentModal({ open, onClose, order, onSuccess }) {
    const [nominal, setNominal] = useState("");
    const [method, setMethod] = useState("CASH");

    const paymentOptions = [
        { value: "CASH", label: "CASH" },
        { value: "TF", label: "TRANSFER (TF)" }
    ];

    useEffect(() => {
        if (open) {
            setNominal("");
            setMethod("CASH");
        }
    }, [open]);

    const sisaTagihan = (order?.total || 0) - (order?.total_paid || 0);

    const handlePartialPay = async (e) => {
        e.preventDefault();
        try {
            const payload = new FormData();
            payload.append("order_id", order.order_id);
            payload.append("nominal", nominal);
            payload.append("payment_method", method);

            await api.post("", payload, { params: { action: "create_payment" } });
            onSuccess();
        } catch (err) {
            console.error(err);
        }
    };

    const handleLunas = async (lunasMethod) => {
        try {
            const payload = new FormData();
            payload.append("order_id", order.order_id);
            payload.append("lunas_method", lunasMethod);

            await api.post("", payload, { params: { action: "create_payment" } });
            onSuccess();
        } catch (err) {
            console.error(err);
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

            <div className="payment-modal-quick-actions">
                <Button
                    size="full-lg"
                    variant="success"
                    icon={<Icon name="payments" />}
                    onClick={() => handleLunas("CASH")}
                >
                    Lunas Cash
                </Button>
                <Button
                    size="full-lg"
                    variant="info"
                    icon={<Icon name="account_balance" />}
                    onClick={() => handleLunas("TF")}
                >
                    Lunas TF
                </Button>
            </div>

            <Form id="paymentForm" onSubmit={handlePartialPay}>
                <Input
                    labelPosition="left"
                    labelWidth={130}
                    name="nominal"
                    value={nominal}
                    onChange={(e) => setNominal(e.target.value)}
                    label="Nominal Bayar"
                    type="number"
                    placeholder="Masukkan nominal"
                    required
                />
                <Select
                    labelPosition="left"
                    labelWidth={130}
                    name="method"
                    label="Metode"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    options={paymentOptions}
                    required
                />
                <Button
                    type="submit"
                    size="full-lg"
                    variant="primary"
                    icon={<Icon name="add" />}
                >
                    Bayar Sebagian
                </Button>
            </Form>
        </Modal>
    );
}