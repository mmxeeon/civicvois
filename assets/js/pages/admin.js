export const adminPage = {
  id: "admin",
  title: "Admin",
  render({ state, setRoute, renderApp }) {
    return state.profile?.role === "admin" ? renderApp("admin") : setRoute("dashboard");
  }
};
