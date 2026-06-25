import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { User } from "../models/User";
import { SupportProblem } from "../models/SupportProblem";
import { SupportFeedback } from "../models/SupportFeedback";

export const reportProblem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { subject, description, screenshot } = req.body;
    if (!subject || !description) {
      return res.status(400).json({ error: "Subject and description are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const newProblem = new SupportProblem({
      userId,
      userName: user.name,
      mobileNumber: user.phone,
      subject,
      description,
      screenshot,
    });

    await newProblem.save();
    return res.status(201).json({ success: true, message: "Problem reported successfully", problem: newProblem });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const submitFeedback = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { rating, feedback } = req.body;
    if (rating === undefined || !feedback) {
      return res.status(400).json({ error: "Rating and feedback text are required" });
    }

    const ratingNum = Number(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: "Rating must be a number between 1 and 5" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const newFeedback = new SupportFeedback({
      userId,
      userName: user.name,
      mobileNumber: user.phone,
      rating: ratingNum,
      feedback,
    });

    await newFeedback.save();
    return res.status(201).json({ success: true, message: "Feedback submitted successfully", feedback: newFeedback });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
