export const authPage = {
  id: "auth",
  title: "Accesso",
  render({ state, setRoute, renderAuthPage }) {
    return state.user ? setRoute("dashboard") : renderAuthPage();
  }
};
