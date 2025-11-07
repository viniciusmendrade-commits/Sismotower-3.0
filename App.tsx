
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { BuildingState, ComponentHealth, DisasterId, BuildingComponentId, MaterialTypeId } from './types';
import { 
  INITIAL_BUILDING_STATE, 
  INITIAL_HEALTH_STATE, 
  COMPONENT_CONFIG, 
  DISASTER_CONFIG,
  MIN_STRUCTURAL_RESISTANCE,
  MAX_STRUCTURAL_RESISTANCE,
  MAX_STRUCTURAL_BONUS
} from './constants';
import { DisasterId as DI, BuildingComponentId as BCI } from './types';
import Building from './components/Building';
import ControlPanel from './components/ControlPanel';
import { SoundOnIcon, SoundOffIcon } from './components/Icons';
import { 
  toggleMute, 
  getIsMuted,
  playMaterialChange, 
  playSimulationStart, 
  playEarthquakeSound,
  playHurricaneSound,
  playTsunamiSound,
  playLightningSound,
  playResultSound,
  playReset
} from './components/sounds';
import { Tutorial } from './components/Tutorial';

const calculateInitialCost = (): number => {
    let cost = 0;
    for (const key in INITIAL_BUILDING_STATE) {
        const componentId = key as BuildingComponentId;
        INITIAL_BUILDING_STATE[componentId].forEach(materialId => {
            cost += COMPONENT_CONFIG[componentId].materials[materialId].cost;
        });
    }
    return cost;
};

export default function App() {
  const [buildingState, setBuildingState] = useState<BuildingState>(INITIAL_BUILDING_STATE);
  const [componentHealth, setComponentHealth] = useState<ComponentHealth>(INITIAL_HEALTH_STATE);
  const [simulationResult, setSimulationResult] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeDisaster, setActiveDisaster] = useState<DisasterId | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number | 'roof'>(0);
  const [totalCost, setTotalCost] = useState<number>(() => calculateInitialCost());
  const [isMuted, setIsMuted] = useState(getIsMuted());
  
  const [tutorialStep, setTutorialStep] = useState<number | null>(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem('tutorialCompleted') === 'true') {
      return null;
    }
    return 0;
  });

  const handleSkipTutorial = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('tutorialCompleted', 'true');
    }
    setTutorialStep(null);
  }, []);

  const handleNextTutorialStep = useCallback(() => {
    if (tutorialStep === null) return;
    const nextStep = tutorialStep + 1;
    if (nextStep >= 9) { // There are 9 steps in the tutorial (0-8)
      handleSkipTutorial();
    } else {
      setTutorialStep(nextStep);
    }
  }, [tutorialStep, handleSkipTutorial]);


  const structuralBonus = useMemo(() => {
    const structuralComponents = [BCI.Pillars, BCI.Beams, BCI.Floor];
    let totalResistance = 0;
    let componentCount = 0;

    structuralComponents.forEach(componentId => {
      buildingState[componentId].forEach(materialId => {
        totalResistance += COMPONENT_CONFIG[componentId].materials[materialId].resistance;
        componentCount++;
      });
    });
    
    if (componentCount === 0) return 0;

    const avgResistance = totalResistance / componentCount;

    if (avgResistance <= MIN_STRUCTURAL_RESISTANCE) return 0;
    if (avgResistance >= MAX_STRUCTURAL_RESISTANCE) return MAX_STRUCTURAL_BONUS;
    
    const bonus = ((avgResistance - MIN_STRUCTURAL_RESISTANCE) / (MAX_STRUCTURAL_RESISTANCE - MIN_STRUCTURAL_RESISTANCE)) * MAX_STRUCTURAL_BONUS;
    
    return bonus;
  }, [buildingState]);

  const handleToggleMute = () => {
    setIsMuted(toggleMute());
  };

  const handleMaterialChange = useCallback((component: BuildingComponentId, material: MaterialTypeId, levelIndex: number) => {
    if (isSimulating || simulationResult) return;

    const oldMaterialId = buildingState[component][levelIndex];
    if (oldMaterialId === material) return;

    playMaterialChange();

    const oldMaterialCost = COMPONENT_CONFIG[component].materials[oldMaterialId].cost;
    const newMaterialCost = COMPONENT_CONFIG[component].materials[material].cost;
    const costDifference = newMaterialCost - oldMaterialCost;

    setBuildingState(prevState => {
      const newState = { ...prevState };
      const newLevels = [...newState[component]];
      newLevels[levelIndex] = material;
      newState[component] = newLevels;
      return newState;
    });

    setTotalCost(prevCost => prevCost + costDifference);
  }, [isSimulating, simulationResult, buildingState]);

  const handleSimulateDisaster = useCallback((disasterId: DisasterId) => {
    playSimulationStart();
    setIsSimulating(true);
    setActiveDisaster(disasterId);
    setSimulationResult(null);

    const disaster = DISASTER_CONFIG[disasterId];
    const newHealth: ComponentHealth = JSON.parse(JSON.stringify(INITIAL_HEALTH_STATE));

    setTimeout(() => {
      switch(disasterId) {
        case DI.Earthquake: playEarthquakeSound(); break;
        case DI.Tsunami: playTsunamiSound(); break;
        case DI.Hurricane: playHurricaneSound(); break;
        case DI.LightningStorm: playLightningSound(); break;
      }

      if (disasterId === DI.LightningStorm) {
        const spdaMaterial = buildingState[BCI.LightningRod][0];
        const spdaResistance = COMPONENT_CONFIG[BCI.LightningRod].materials[spdaMaterial].resistance;
        const effectivePower = Math.max(0, disaster.power - spdaResistance);

        Object.keys(newHealth).forEach(key => {
            const componentId = key as BCI;
            if (componentId !== BCI.LightningRod) {
              newHealth[componentId] = newHealth[componentId].map(() => 100);
            }
        });

        if (spdaResistance < disaster.power) {
          newHealth[BCI.LightningRod][0] = Math.max(0, 100 - (disaster.power - spdaResistance) * 2);
          newHealth[BCI.Roof][0] = Math.max(0, 100 - (effectivePower * 1.2 * (1 - structuralBonus)));

          for (let i = 0; i < 3; i++) {
            const floorIndex = newHealth[BCI.Beams].length - 1 - i;
            if (floorIndex < 0) break;

            const damageMultiplier = 1 / (i * 1.5 + 1);
            const baseDamage = effectivePower * damageMultiplier;
            const finalDamage = baseDamage * (1 - structuralBonus);

            newHealth[BCI.Beams][floorIndex] = Math.max(0, 100 - finalDamage / 1.25);
            newHealth[BCI.Walls][floorIndex] = Math.max(0, 100 - finalDamage / 1.5);
            newHealth[BCI.Glass][floorIndex] = Math.max(0, 100 - finalDamage / 2);
            newHealth[BCI.Pillars][floorIndex] = Math.max(0, 100 - finalDamage / 1.2);
            newHealth[BCI.Floor][floorIndex] = Math.max(0, 100 - finalDamage / 1.8);
          }
        }
      } else {
        let defenseResistance = 0;
        switch(disasterId) {
            case DI.Hurricane:
                defenseResistance = COMPONENT_CONFIG[BCI.WindDampers].materials[buildingState[BCI.WindDampers][0]].resistance;
                break;
            case DI.Tsunami:
                defenseResistance = COMPONENT_CONFIG[BCI.TsunamiBarriers].materials[buildingState[BCI.TsunamiBarriers][0]].resistance;
                break;
            case DI.Earthquake:
                defenseResistance = COMPONENT_CONFIG[BCI.SeismicDampers].materials[buildingState[BCI.SeismicDampers][0]].resistance;
                break;
        }
        const effectivePower = Math.max(0, disaster.power - defenseResistance);

        const defenseComponents = [BCI.LightningRod, BCI.WindDampers, BCI.TsunamiBarriers, BCI.SeismicDampers];

        for (const key in buildingState) {
          const componentId = key as BuildingComponentId;
          if (defenseComponents.includes(componentId)) {
            newHealth[componentId][0] = 100;
            continue;
          }
          
          buildingState[componentId].forEach((materialId, index) => {
              const resistance = COMPONENT_CONFIG[componentId].materials[materialId].resistance;
              let damage = Math.max(0, effectivePower - resistance);
              
              if(disasterId === DI.Tsunami) {
                // O dano do tsunami diminui com a altura, afetando mais os andares inferiores.
                const damageMultiplier = 1.5 - (index / buildingState[componentId].length);
                damage *= Math.max(0, damageMultiplier);
              }
              if(disasterId === DI.Earthquake) {
                damage *= (1.2 - (index / (buildingState[componentId].length * 2)));
              }
              
              damage *= (1 - structuralBonus);

              newHealth[componentId][index] = Math.max(0, 100 - damage);
          });
        }
      }

      setComponentHealth(newHealth);
      
      const allHealthValues: number[] = Object.values(newHealth).flat();
      // FIX: Add explicit types to the arguments of the reduce function to prevent TypeScript from throwing a type error for the arithmetic operation.
      const averageHealth = allHealthValues.reduce((a: number, b: number) => a + b, 0) / allHealthValues.length;
      
      const finalHealth = averageHealth.toFixed(0);
      let resultMessage = '';
      if (averageHealth > 75) {
        resultMessage = `O edifício resistiu bravamente com danos mínimos! (Integridade: ${finalHealth}%)`;
      } else if (averageHealth > 50) {
        resultMessage = `O edifício sofreu danos significativos, mas permaneceu de pé. (Integridade: ${finalHealth}%)`;
      } else if (averageHealth > 20) {
        resultMessage = `A estrutura foi severamente comprometida! Risco de colapso. (Integridade: ${finalHealth}%)`;
      } else {
        resultMessage = `Colapso total! A estrutura não resistiu ao desastre. (Integridade: ${finalHealth}%)`;
      }
      
      playResultSound(averageHealth);
      setSimulationResult(resultMessage);
      setIsSimulating(false);
    }, 2000);
  }, [buildingState, structuralBonus]);

  const handleReset = useCallback(() => {
    playReset();
    setBuildingState(INITIAL_BUILDING_STATE);
    setComponentHealth(INITIAL_HEALTH_STATE);
    setSimulationResult(null);
    setIsSimulating(false);
    setActiveDisaster(null);
    setSelectedLevel(0);
    setTotalCost(calculateInitialCost());
  }, []);

  const overallHealth = useMemo(() => {
    // FIX: Replaced `.flat()` with `[].concat(...)` because `.flat()` was being inferred as `unknown[]`, causing a type error. This ensures the array is flattened correctly and typed as `number[]`.
    const allHealthValues: number[] = [].concat(...Object.values(componentHealth));
    if (allHealthValues.length === 0) return 100;
    return allHealthValues.reduce((a: number, b: number) => a + b, 0) / allHealthValues.length;
  }, [componentHealth]);

  const getHealthBarColor = (health: number) => {
    if (health > 70) {
      return 'bg-gradient-to-r from-emerald-500 to-green-500';
    }
    if (health > 30) {
      return 'bg-gradient-to-r from-yellow-500 to-amber-500';
    }
    return 'bg-gradient-to-r from-red-600 to-rose-600';
  };

  return (
    <div className="min-h-screen text-white flex flex-col items-center p-4 sm:p-6 lg:p-8">
      
      {tutorialStep !== null && (
        <Tutorial 
          step={tutorialStep} 
          onNext={handleNextTutorialStep}
          onSkip={handleSkipTutorial} 
        />
      )}
      
      <header className="w-full max-w-7xl text-center mb-8 relative">
        <h1 className="text-4xl md:text-5xl font-bold font-orbitron text-amber-400 tracking-wider">
          Sismotower: Cataclismo
        </h1>
        <p className="text-slate-300 mt-2 text-lg">
          Construa seu edifício, andar por andar, e teste sua resistência contra catástrofes.
        </p>
         <button 
          onClick={handleToggleMute}
          className="absolute top-0 right-0 w-11 h-11 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-amber-400 hover:bg-slate-700 transition-all duration-200 transform hover:scale-110 shadow-lg"
          aria-label={isMuted ? "Ativar som" : "Desativar som"}
          title={isMuted ? "Ativar som" : "Desativar som"}
        >
          {isMuted ? <SoundOffIcon className="w-6 h-6" /> : <SoundOnIcon className="w-6 h-6" />}
        </button>
      </header>
      
      <main className="w-full max-w-7xl flex flex-col lg:flex-row gap-8">
        <div id="tutorial-building-area" className="lg:w-2/3 flex-shrink-0 flex flex-col items-center justify-center bg-slate-900/70 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-800 p-4">
           <div className="w-full mb-4 px-2" id="tutorial-health-bar">
                <div className="flex justify-between items-baseline px-1 mb-1">
                    <p className="text-sm font-semibold text-slate-300 tracking-wide">Integridade Estrutural</p>
                    <p className="text-lg font-bold font-orbitron text-white">{overallHealth.toFixed(0)}%</p>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-4 border border-slate-700">
                    <div 
                        className={`${getHealthBarColor(overallHealth)} h-full rounded-full transition-all duration-500`} 
                        style={{ width: `${overallHealth}%`}}
                    ></div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                        <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-wider">Custo Total</h3>
                        <p className="text-xl font-bold font-orbitron text-white">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCost)}
                        </p>
                    </div>
                    <div id="tutorial-structural-bonus" className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                        <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-wider">Bônus Estrutural</h3>
                        <p className="text-xl font-bold font-orbitron text-white">
                            +{(structuralBonus * 100).toFixed(0)}%
                        </p>
                    </div>
                </div>
            </div>
          <Building 
            buildingState={buildingState}
            componentHealth={componentHealth}
            isSimulating={isSimulating}
            activeDisaster={activeDisaster}
          />
        </div>

        <div className="lg:w-1/3 flex-shrink-0 bg-slate-900/70 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-800 p-6">
          <ControlPanel
            buildingState={buildingState}
            onMaterialChange={handleMaterialChange}
            onSimulateDisaster={handleSimulateDisaster}
            onReset={handleReset}
            isSimulating={isSimulating}
            simulationResult={simulationResult}
            selectedLevel={selectedLevel}
            onSelectLevel={setSelectedLevel}
          />
        </div>
      </main>
    </div>
  );
}
