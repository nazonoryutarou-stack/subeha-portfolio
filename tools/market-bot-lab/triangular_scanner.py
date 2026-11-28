#!/usr/bin/env python3
"""Read-only triangular arbitrage scanner. NO ORDERS, NO KEYS, NO LIVE TRADING.

Binance's publicly documented bookTicker endpoint supplies best bid/ask prices.
All returned opportunities are *indicative*; independent REST quotes aren't atomic,
and liquidity, latency, transfer constraints and deeper execution are NOT modeled.
"""
import argparse
import json
import time
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

ENDPOINT = "https://data-api.binance.vision/api/v3/ticker/bookTicker"
PATHS = (
    ("USDT", "BTC", "ETH", "USDT"),
    ("USDT", "ETH", "BTC", "USDT"),
)
PAIRS = {"BTCUSDT", "ETHUSDT", "ETHBTC"}

def fetch_prices(timeout=8):
    req = urllib.request.Request(ENDPOINT, headers={"User-Agent": "market-bot-lab/0.1"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        raw = response.read(3_000_000)
    data = json.loads(raw)
    found = {}
    for row in data:
        symbol = row.get("symbol")
        if symbol in PAIRS:
            try:
                bid, ask = Decimal(row["bidPrice"]), Decimal(row["askPrice"])
                bid_qty, ask_qty = Decimal(row["bidQty"]), Decimal(row["askQty"])
            except (KeyError, InvalidOperation):
                continue
            if min(bid, ask, bid_qty, ask_qty) > 0 and ask >= bid:
                found[symbol] = {"bid":bid, "ask":ask,
                                 "bid_qty":bid_qty, "ask_qty":ask_qty}
    if set(found) != PAIRS:
        raise ValueError("Required BTC/ETH/USDT quotes are unavailable")
    return found

def exchange(amount, src, dst, quotes, fee):
    # Buy base with quote at ask, or sell base for quote at bid.
    for base, quote in (("BTC", "USDT"), ("ETH", "USDT"), ("ETH", "BTC")):
        t = quotes[base + quote]
        if (src, dst) == (quote, base):
            return amount / t["ask"] * (1-fee), base+quote, "BUY", str(t["ask"])
        if (src, dst) == (base, quote):
            return amount * t["bid"] * (1-fee), base+quote, "SELL", str(t["bid"])
    raise ValueError("Unsupported pair: "+src+" "+dst)

def scan(quotes, start, fee_pct, slippage_pct):
    fee = (fee_pct + slippage_pct) / Decimal(100)
    if not Decimal(0) <= fee < Decimal(1):
        raise ValueError("Invalid costs")
    result = []
    for path in PATHS:
        amount = start
        legs = []
        for src,dst in zip(path,path[1:]):
            amount, symbol, side, price = exchange(amount, src, dst, quotes, fee)
            legs.append({"symbol":symbol,"action":side,"price":price})
        profit = amount-start
        result.append({"route":" > ".join(path), "start_usdt":str(start),
                       "estimated_end_usdt":str(amount.quantize(Decimal(".000001"))),
                       "estimated_net_pct":str(((amount/start-1)*100).quantize(Decimal(".0001"))),
                       "indicative_positive":profit>0,"legs":legs})
    return result

def main():
    p=argparse.ArgumentParser(description="No orders; public-data scan only.")
    p.add_argument("--interval",type=float,default=5)
    p.add_argument("--cycles",type=int,default=1,help="0 means repeat until Ctrl-C")
    p.add_argument("--start",type=Decimal,default=Decimal("100"))
    p.add_argument("--fee-pct",type=Decimal,default=Decimal("0.1"),
                   help="assumed fee per leg; NOT fetched from account")
    p.add_argument("--slippage-pct",type=Decimal,default=Decimal("0.05"),
                   help="assumed slippage per leg; NOT a liquidity estimate")
    args=p.parse_args()
    if args.start<=0 or args.interval<1 or args.cycles<0: p.error("invalid arguments")
    n=0
    while args.cycles==0 or n<args.cycles:
        try:
            quotes=fetch_prices()
            payload={"timestamp_utc":datetime.now(timezone.utc).isoformat(),
                     "source":"Binance public non-atomic REST bookTicker",
                     "mode":"READ_ONLY_NO_ORDERS",
                     "routes":scan(quotes,args.start,args.fee_pct,args.slippage_pct)}
            print(json.dumps(payload,ensure_ascii=False),flush=True)
        except Exception as exc:
            print(json.dumps({"error":str(exc),"mode":"READ_ONLY_NO_ORDERS"}),flush=True)
        n+=1
        if args.cycles==0 or n<args.cycles: time.sleep(args.interval)

if __name__=="__main__":
    main()
