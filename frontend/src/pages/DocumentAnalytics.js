// src/pages/DocumentAnalytics.js
import React from 'react';
import { useParams } from 'react-router-dom';
import DashboardContainer from '../components/Analytics/DashboardContainer';

const DocumentAnalytics = () => {
  const { documentId } = useParams();

  return (
    <div style={{ 
      backgroundColor: '#f8fafc', 
      minHeight: '100vh',
      paddingTop: '1rem'
    }}>
      <DashboardContainer />
    </div>
  );
};

export default DocumentAnalytics;