import Table from '../components/Table/Table';
import { productStore } from "../store/auth.store";

export default function Store() {
    const products = productStore.getProducts();
    console.log('Products:', products);
    const columns = [
        { key: 'name', title: 'Name' },
        { key: 'price', title: 'Price' },
        { key: 'quantity', title: 'Quantity' }
    ];

    const data = [
        { name: 'Product 1', price: 10.99, quantity: 5 },
        { name: 'Product 2', price: 15.99, quantity: 3 },
        { name: 'Product 3', price: 20.99, quantity: 2 }
    ];

    return (
        <div>
            <h1>Store</h1>
            <Table columns={columns} data={data} id="store-table" />
        </div>
    );
}