import { adminPage } from "./admin.js";
import { authPage } from "./auth.js";
import { completeProfilePage } from "./complete-profile.js";
import { dashboardPage } from "./dashboard.js";
import { detailPage } from "./detail.js";
import { homePage } from "./home.js";
import { newReportPage } from "./new-report.js";
import { profilePage } from "./profile.js";
import { settingsPage } from "./settings.js";

export const pageRoutes = {
  landing: homePage,
  auth: authPage,
  "complete-profile": completeProfilePage,
  report: detailPage,
  dashboard: dashboardPage,
  new: newReportPage,
  profile: profilePage,
  settings: settingsPage,
  admin: adminPage
};
