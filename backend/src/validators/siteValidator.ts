import { Request, Response, NextFunction } from "express";

export const validateCreateSite = (req: Request, res: Response, next: NextFunction) => {
  const { name, projectType, address, startDate } = req.body;

  const errors: string[] = [];

  if (!name || typeof name !== "string" || !name.trim()) {
    errors.push("Site Name is required");
  }

  if (!projectType || typeof projectType !== "string" || !projectType.trim()) {
    errors.push("Project Type is required");
  }

  if (!address || typeof address !== "string" || !address.trim()) {
    errors.push("Site Address is required");
  }

  if (!startDate) {
    errors.push("Start Date is required");
  } else {
    const parsedDate = Date.parse(startDate);
    if (isNaN(parsedDate)) {
      errors.push("Invalid Start Date format");
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(", ") });
  }

  next();
};

export const validateUpdateSite = (req: Request, res: Response, next: NextFunction) => {
  const { name, projectType, address, startDate, status } = req.body;

  const errors: string[] = [];

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    errors.push("Site Name cannot be empty");
  }

  if (projectType !== undefined && (typeof projectType !== "string" || !projectType.trim())) {
    errors.push("Project Type cannot be empty");
  }

  if (address !== undefined && (typeof address !== "string" || !address.trim())) {
    errors.push("Site Address cannot be empty");
  }

  if (startDate !== undefined) {
    const parsedDate = Date.parse(startDate);
    if (isNaN(parsedDate)) {
      errors.push("Invalid Start Date format");
    }
  }

  if (status !== undefined) {
    const validStatuses = ["Planning", "Started", "In Progress", "On Hold", "Delayed", "Completed", "Active"];
    if (!validStatuses.includes(status)) {
      errors.push(`Status must be one of: ${validStatuses.join(", ")}`);
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(", ") });
  }

  next();
};
