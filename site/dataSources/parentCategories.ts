import parentCategories from "../../assets/data/parent-categories.json" assert {
  type: "json",
};

function getParentCategories() {
  return parentCategories;
}

export default getParentCategories;
