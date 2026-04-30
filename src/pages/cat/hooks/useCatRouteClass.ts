import { useEffect } from "react";

export function useCatRouteClass() {
  useEffect(() => {
    document.body.classList.add("cat-route");
    return () => document.body.classList.remove("cat-route");
  }, []);
}
