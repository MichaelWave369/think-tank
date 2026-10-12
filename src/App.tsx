import { ThinkTankRoom } from "./components/ThinkTankRoom";
import { BehaviorLabPanel } from "./components/BehaviorLabPanel";

export default function App(){
 return <>
  <ThinkTankRoom/>
  <div id="software-behavior-lab" className="behavior-app-section">
   <BehaviorLabPanel/>
  </div>
 </>;
}
