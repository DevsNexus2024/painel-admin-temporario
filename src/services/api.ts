
import { TcrResponse, ExternalDeposit } from "../types/deposit";

export const fetchTcrDeposits = async (email: string): Promise<TcrResponse> => {
  try {
    const response = await fetch(
      `${import.meta.env.X_DIAGNOSTICO_API_URL}/admin/depositos/email/usuario/${email}?por_pagina=600`,
      {
        method: 'GET',
        headers: {
          'User-Agent': import.meta.env.X_API_USER_AGENT,
          'Token-Cryp-Access': import.meta.env.X_TOKEN_CRYP_ACCESS,
          'Token-Whitelabel': import.meta.env.X_TOKEN_WHITELABEL
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {

    throw error;
  }
};

export const fetchExternalDeposits = async (email: string): Promise<ExternalDeposit[]> => {
  try {
    const response = await fetch(
      `${import.meta.env.X_DIAGNOSTICO_API_URL}/admin/depositos/bb/usuario/${email}`,
      {
        method: 'GET',
        headers: {
          'User-Agent': import.meta.env.X_API_USER_AGENT,
          'Token-Cryp-Access': import.meta.env.X_TOKEN_CRYP_ACCESS,
          'Token-Whitelabel': import.meta.env.X_TOKEN_WHITELABEL
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
      `${import.meta.env.X_DIAGNOSTICO_API_URL}/admin/depositos/processar-manual`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': import.meta.env.X_API_USER_AGENT,
          'Token-Cryp-Access': import.meta.env.X_TOKEN_CRYP_ACCESS,
          'Token-Whitelabel': import.meta.env.X_TOKEN_WHITELABEL
        },
        body: JSON.stringify(depositWithCustomId)
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {

    throw error;
  }
};
