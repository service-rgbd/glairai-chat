import { ListSupportedCountriesResponse } from "@workspace/api-zod";
import { Router, type IRouter } from "express";

import { chatService } from "../lib/chat-service";
import { detectCountryCodeFromRequest } from "../lib/geo-location";

const router: IRouter = Router();

router.get("/metadata/geo", async (req, res) => {
  try {
    const result = await detectCountryCodeFromRequest(req);
    res.json(result);
  } catch {
    res.json({ countryCode: null, source: "unknown" });
  }
});

router.get("/metadata/countries", async (_req, res) => {
  const result = await chatService.listSupportedCountries();
  res.json(ListSupportedCountriesResponse.parse(result));
});

export default router;
