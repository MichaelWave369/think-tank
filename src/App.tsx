import { ThinkTankRoom } from "./components/ThinkTankRoom";
import { BehaviorLabPanel } from "./components/BehaviorLabPanel";

export default function App(){
 return <>
  <nav className="behavior-app-nav"><a href="#software-behavior-lab">JUMP TO SOFTWARE BEHAVIOR LAB ↓</a></nav>
  <ThinkTankRoom/>
  <div id="software-behavior-lab" className="behavior-app-section">
   <BehaviorLabPanel/>
  </div>
 </>;
}
