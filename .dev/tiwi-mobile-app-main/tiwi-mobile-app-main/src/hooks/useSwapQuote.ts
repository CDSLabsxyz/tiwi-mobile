/**
 * Custom hook for fetching swap quotes
 * Extracted from swap.tsx to separate business logic from UI
 */

import { useEffect, useRef, useState } from "react";
import { useSwapStore } from "@/store/swapStore";
import { fetchSwapQuote } from "@/services/swapService";

/**
 * Hook for managing swap quote fetching with debouncing
 * Automatically fetches quote when form inputs change
 */
export const useSwapQuote = () => {
  const {
    fromAmount,
    fromToken,
    fromChain,
    toToken,
    toChain,
    setToAmount,
    setToFiatAmount,
    setSwapQuote,
  } = useSwapStore();
  
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Reset if amount is empty
    if (!fromAmount || parseFloat(fromAmount) === 0) {
      setToAmount("");
      setToFiatAmount("$0");
      setIsLoading(false);
      setSwapQuote(null);
      return;
    }
    
    // Require all fields before fetching quote
    if (!fromToken || !fromChain || !toToken || !toChain) {
      setToAmount("");
      setToFiatAmount("$0");
      setIsLoading(false);
      setSwapQuote(null);
      return;
    }
    
    // Debounce quote fetching (300ms delay)
    setIsLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const quote = await fetchSwapQuote(
          fromAmount,
          fromToken.id,
          toToken.id
        );
        
        // Update TO amount from quote
        if (quote.toAmount && quote.toAmount !== "" && parseFloat(quote.toAmount) > 0) {
          setToAmount(quote.toAmount);
          setToFiatAmount(quote.fiatAmount);
        } else {
          // Fallback calculation
          const fallbackAmount = (parseFloat(fromAmount) * 0.95).toString();
          setToAmount(fallbackAmount);
          setToFiatAmount(`$${(parseFloat(fallbackAmount) * 1.0).toFixed(2)}`);
        }
        
        // Update swap details
        setSwapQuote({
          gasFee: quote.gasFee,
          slippage: `${quote.slippage}%`,
          twcFee: quote.twcFee,
          source: quote.source,
        });
      } catch (error) {
        console.error("❌ Failed to fetch quote:", error);
        // Fallback calculation on error
        const fallbackAmount = (parseFloat(fromAmount) * 0.95).toString();
        setToAmount(fallbackAmount);
        setToFiatAmount(`$${(parseFloat(fallbackAmount) * 1.0).toFixed(2)}`);
        
        // Set fallback swap details
        setSwapQuote({
          gasFee: "0.001%",
          slippage: "0.5%",
          twcFee: "0.40%",
          source: ["Best", "TWC"],
        });
      } finally {
        setIsLoading(false);
      }
    }, 300);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fromAmount, fromToken, fromChain, toToken, toChain, setToAmount, setToFiatAmount, setSwapQuote]);
  
  return { isLoading };
};

