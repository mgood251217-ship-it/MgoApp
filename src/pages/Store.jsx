import { useEffect, useState, useCallback, useMemo } from 'react';
import api from "../api/axios";
import Header from "../components/Header/Header";
import Input from "../components/Input/Input";
import Table from "../components/Table/Table";
import Button from "../components/Button/Button";
import Select from "../components/Select/Select";
import Form from "../components/Form/Form";
import Modal from "../components/Modal/Modal";
import Icon from "../components/Icon/Icon";

export default function Store() {
    const [users, setUsers] = useState([]);
    const [machines, setMachines] = useState([]);
    const [locations, setLocations] = useState([]);
    const loadData = useCallback(async () => {
        try{
            const resUsers = await api.get("", {
                params : 'users'
            })
            setUsers(resUsers.data?.data ?? [])

            const resMachines = await api.get("", {
                params : 'machines'
            })
            setMachines(resMachines.data?.data ?? [])

            const resLocations = await api.get("", {
                params : 'locations'
            })
            setLocations(resLocations.data?.data ?? [])

            console.log(resUsers);
            
        }catch (error){
            console.log(error)
        }
    });



    return (
        <>
        </>
    );
}