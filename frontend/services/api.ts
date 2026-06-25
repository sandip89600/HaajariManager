import axios from "axios";

export const api = axios.create({
  baseURL: "https://haajarimanager-production.up.railway.app/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});