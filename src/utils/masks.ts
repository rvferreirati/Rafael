export const onlyDigits = (value: string): string => (value || '').replace(/\D/g, '');

/**
 * Aplica máscara automática de CPF (000.000.000-00) até 11 dígitos
 * ou CNPJ (00.000.000/0000-00) de 12 até 14 dígitos.
 */
export const formatCpfCnpj = (value: string): string => {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length === 0) return '';

  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  }

  // CNPJ: 00.000.000/0000-00
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

/**
 * Aplica máscara automática de CEP: 00000-000 (8 dígitos).
 */
export const formatCep = (value: string): string => {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length === 0) return '';
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

export const isValidCep = (value: string): boolean => onlyDigits(value).length === 8;

const checkCpfDigits = (digits: string): boolean => {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i], 10) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i], 10) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(digits[10], 10);
};

const checkCnpjDigits = (digits: string): boolean => {
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i], 10) * weights1[i];
  let mod = sum % 11;
  const d1 = mod < 2 ? 0 : 11 - mod;
  if (d1 !== parseInt(digits[12], 10)) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i], 10) * weights2[i];
  mod = sum % 11;
  const d2 = mod < 2 ? 0 : 11 - mod;
  return d2 === parseInt(digits[13], 10);
};

export const validateCpfCnpj = (
  value: string
): { valid: boolean; type: 'CPF' | 'CNPJ' | null; message?: string } => {
  const digits = onlyDigits(value);
  if (digits.length === 0) return { valid: true, type: null };

  if (digits.length < 11) {
    return {
      valid: false,
      type: null,
      message: `Faltam dígitos (${digits.length}/11 para CPF ou ${digits.length}/14 para CNPJ)`,
    };
  }
  if (digits.length === 11) {
    const ok = checkCpfDigits(digits);
    return {
      valid: ok,
      type: 'CPF',
      message: ok ? 'CPF válido' : 'Dígito verificador do CPF inválido',
    };
  }
  if (digits.length < 14) {
    return {
      valid: false,
      type: 'CNPJ',
      message: `CNPJ incompleto (${digits.length}/14 dígitos)`,
    };
  }
  const ok = checkCnpjDigits(digits);
  return {
    valid: ok,
    type: 'CNPJ',
    message: ok ? 'CNPJ válido' : 'Dígito verificador do CNPJ inválido',
  };
};

export const lookupAddressByCep = async (
  cep: string
): Promise<{
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  formatted: string;
} | null> => {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.erro) return null;

    const street = data.logradouro || '';
    const neighborhood = data.bairro || '';
    const city = data.localidade || '';
    const state = data.uf || '';

    const parts = [
      street,
      neighborhood,
      city && state ? `${city} - ${state}` : city || state,
    ].filter(Boolean);

    return {
      street,
      neighborhood,
      city,
      state,
      formatted: parts.join(', '),
    };
  } catch {
    return null;
  }
};
