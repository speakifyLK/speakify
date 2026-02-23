import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function Home() {
  return (
    <div>  
      <p className="text-green-500 font-bold text-2xl">
        Hello Speakify!
      </p>
      <Button variant="outline">Click Me</Button>
    </div>
  );
}
