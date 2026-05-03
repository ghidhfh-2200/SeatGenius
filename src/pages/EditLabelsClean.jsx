import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Layout } from 'antd';
import FactorLabelManagement from '../components/MakeSeatList/FactorLabelManagement';

const { Content } = Layout;

const EditLabelsClean = () => {
    const location = useLocation();
    const names = useMemo(() => {
        const fromState = location.state?.names;
        return Array.isArray(fromState) ? fromState : [];
    }, [location.state]);

    return (
        <Layout style={{ minHeight: '100vh', overflow: 'hidden' }}>
            <Content style={{ padding: 16, height: '100vh', overflow: 'hidden' }}>
                <FactorLabelManagement names={names} />
            </Content>
        </Layout>
    );
};

export default EditLabelsClean;
