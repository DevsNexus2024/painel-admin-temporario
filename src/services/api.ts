
import { TcrResponse, ExternalDeposit } from "../types/deposit";

export const fetchTcrDeposits = async (email: string): Promise<TcrResponse> => {
  try {
    const response = await fetch(
      `https://vps80270.cloudpublic.com.br:8081/admin/depositos/email/usuario/${email}?por_pagina=600`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'insomnia/10.3.0',
          'Token-Cryp-Access': '7beda78857f0fd864075a04d72ed69ee133210375276e5c8a4e910190a27c8f61738e87f9b19bfed00bc72f8f889bac5558ea1d21cb90528b7310f87d546f665935ed604f7e65abfa640de0f3d2a828c',
          'Token-Whitelabel': 'a4d4a90d59d99b8b8cc3a843d6a0f89cf3e5a1c4809a3b85f1eaf0a4b5b8928e'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching TCR deposits:", error);
    throw error;
  }
};

export const fetchExternalDeposits = async (email: string): Promise<ExternalDeposit[]> => {
  try {
    const response = await fetch(
      `https://vps80270.cloudpublic.com.br:8081/admin/depositos/bb/usuario/${email}`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'insomnia/10.3.0',
          'Token-Cryp-Access': '7beda78857f0fd864075a04d72ed69ee133210375276e5c8a4e910190a27c8f61738e87f9b19bfed00bc72f8f889bac5558ea1d21cb90528b7310f87d546f665935ed604f7e65abfa640de0f3d2a828c',
          'Token-Whitelabel': 'a4d4a90d59d99b8b8cc3a843d6a0f89cf3e5a1c4809a3b85f1eaf0a4b5b8928e'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.mensagem !== "OK" || !data.response) {
      throw new Error('Resposta da API externa inválida');
    }
    
    return data.response;
  } catch (error) {
    console.error("Error fetching external deposits:", error);
    throw error;
  }
};

export const processManualDeposit = async (deposit: ExternalDeposit, customId: string): Promise<any> => {
  try {
    const depositWithCustomId = {
      ...deposit,
      customId
    };
    
    const response = await fetch(
      `https://vps80270.cloudpublic.com.br:8081/admin/depositos/processar-manual`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'insomnia/10.2.0',
          'Token-Cryp-Access': '7beda78857f0fd864075a04d72ed69ee133210375276e5c8a4e910190a27c8f61738e87f9b19bfed00bc72f8f889bac5558ea1d21cb90528b7310f87d546f665935ed604f7e65abfa640de0f3d2a828c',
          'Token-Whitelabel': 'a4d4a90d59d99b8b8cc3a843d6a0f89cf3e5a1c4809a3b85f1eaf0a4b5b8928e'
        },
        body: JSON.stringify(depositWithCustomId)
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error processing manual deposit:", error);
    throw error;
  }
};
