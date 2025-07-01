import { ChakraProvider } from "@chakra-ui/react";
import React from "react";
import { render } from "react-dom";
import { ComponentPreview } from "./ComponentPreview";
render(<ChakraProvider>
    <ComponentPreview />
  </ChakraProvider>, document.getElementById("root"));