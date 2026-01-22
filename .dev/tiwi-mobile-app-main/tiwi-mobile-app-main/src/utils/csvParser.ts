/**
 * CSV Parser Utilities
 * Extracts addresses from CSV/XLSX files
 */

/**
 * Parses CSV text content and extracts addresses
 * Supports various CSV formats and column arrangements
 */
export const parseCSVAddresses = (csvText: string): string[] => {
  const addresses: string[] = [];
  
  // Split by lines
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  if (lines.length === 0) return addresses;
  
  // Try to detect header row (common patterns)
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('address') || 
                    firstLine.includes('wallet') || 
                    firstLine.includes('recipient') ||
                    firstLine.includes('to');
  
  const dataLines = hasHeader ? lines.slice(1) : lines;
  
  // Common address patterns
  const addressPatterns = [
    /^0x[a-fA-F0-9]{40}$/, // Ethereum/EVM
    /^0x[a-fA-F0-9]{64}$/, // SUI
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/, // Solana
    /^[a-z]{1,83}1[a-z0-9]{38,58}$/, // Cosmos
  ];
  
  dataLines.forEach((line) => {
    // Split by comma, semicolon, or tab
    const columns = line.split(/[,;\t]/).map(col => col.trim().replace(/^["']|["']$/g, ''));
    
    columns.forEach((column) => {
      // Check if column matches any address pattern
      const trimmed = column.trim();
      if (trimmed.length > 10) { // Minimum address length
        // Check against patterns
        const isAddress = addressPatterns.some(pattern => pattern.test(trimmed));
        if (isAddress && !addresses.includes(trimmed)) {
          addresses.push(trimmed);
        }
      }
    });
  });
  
  // If no addresses found with patterns, try to extract any long alphanumeric strings
  if (addresses.length === 0) {
    dataLines.forEach((line) => {
      const columns = line.split(/[,;\t]/).map(col => col.trim().replace(/^["']|["']$/g, ''));
      columns.forEach((column) => {
        const trimmed = column.trim();
        // Look for strings that look like addresses (long alphanumeric)
        if (trimmed.length >= 26 && trimmed.length <= 66 && /^[a-zA-Z0-9]+$/.test(trimmed)) {
          if (!addresses.includes(trimmed)) {
            addresses.push(trimmed);
          }
        }
      });
    });
  }
  
  return addresses;
};

/**
 * Validates if a file is CSV or Excel format
 */
export const isValidCSVFile = (fileName: string, mimeType?: string): boolean => {
  const lowerFileName = fileName.toLowerCase();
  const validExtensions = ['.csv', '.xlsx', '.xls'];
  const validMimeTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  
  const hasValidExtension = validExtensions.some(ext => lowerFileName.endsWith(ext));
  const hasValidMimeType = mimeType ? validMimeTypes.includes(mimeType) : false;
  
  return hasValidExtension || hasValidMimeType;
};

