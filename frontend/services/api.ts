import axios from "axios";
import { API_URL } from "@/utils/storage";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});
