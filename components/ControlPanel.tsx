
import React, { useState } from 'react';
import type { BuildingState, BuildingComponentId, MaterialTypeId, DisasterId } from '../types';
import { COMPONENT_CONFIG, DISASTER_CONFIG, NUMBER_OF_FLOORS } from '../constants';
import { BuildingComponentId as BCI } from '../types';
import { playClick } from './sounds';

interface ControlPanelProps {
  buildingState: BuildingState;
  onMaterialChange: (component: BuildingComponentId, material: MaterialTypeId, levelIndex: number) => void;
  onSimulateDisaster: (disaster: DisasterId) => void;
  onReset: () => void;
  isSimulating: boolean;
  simulationResult: string | null;
  selectedLevel: number | 'roof';
  onSelectLevel: (level: number | 'roof') => void;
}

const MaterialSelector: React.FC<{
  componentId: BuildingComponentId;
  currentMaterial: MaterialTypeId;
  onChange: (material: MaterialTypeId) => void;
  disabled: boolean;
}> = ({ componentId, currentMaterial, onChange, disabled }) => {
  const config = COMPONENT_CONFIG[componentId];
  return (
    <div className={`mb-4 transition-opacity duration-300 ${disabled && currentMaterial === 'weak' ? 'opacity-50' : 'opacity-100'}`}>
      <h3 className="text-lg font-semibold text-amber-300 mb-2">{config.label}</h3>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(config.materials) as MaterialTypeId[]).map((materialId) => {
          const material = config.materials[materialId];
          const isSelected = currentMaterial === materialId;
          return (
            <button
              key={materialId}
              onClick={() => onChange(materialId)}
              disabled={disabled}
              className={`group p-2 text-center rounded-md transition-all duration-200 flex flex-col justify-center items-center h-20
                ${isSelected ? 'bg-amber-500 text-slate-900 font-bold shadow-md shadow-amber-500/20' : 'bg-slate-800 hover:bg-slate-700'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <span className="text-sm font-semibold leading-tight">{material.name}</span>
              <span className={`text-xs font-mono mt-1 transition-opacity duration-200 ${isSelected ? 'opacity-90' : 'opacity-0 group-hover:opacity-90'}`}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(material.cost)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

type Tab = 'build' | 'defense' | 'simulate';

const ControlPanel: React.FC<ControlPanelProps> = ({
  buildingState,
  onMaterialChange,
  onSimulateDisaster,
  onReset,
  isSimulating,
  simulationResult,
  selectedLevel,
  onSelectLevel,
}) => {
  const isControlsDisabled = isSimulating || !!simulationResult;
  const [activeTab, setActiveTab] = useState<Tab>('build');

  const disasterButtonColors: Record<DisasterId, string> = {
    lightningStorm: 'bg-purple-700 hover:bg-purple-600',
    hurricane: 'bg-slate-700 hover:bg-slate-600',
    tsunami: 'bg-blue-700 hover:bg-blue-600',
    earthquake: 'bg-orange-700 hover:bg-orange-600',
  };

  const floorComponents: BuildingComponentId[] = [BCI.Pillars, BCI.Beams, BCI.Walls, BCI.Glass, BCI.Floor];
  const roofComponents: BuildingComponentId[] = [BCI.Roof];
  const defenseComponents: BuildingComponentId[] = [BCI.LightningRod, BCI.WindDampers, BCI.TsunamiBarriers, BCI.SeismicDampers];
  
  const activeDefenseSystem = defenseComponents.find(id => buildingState[id][0] !== 'weak') || null;

  const levelIndex = selectedLevel === 'roof' ? 0 : selectedLevel;
  const componentsToShow = selectedLevel === 'roof' ? roofComponents : floorComponents;

  const tabs: {id: Tab, label: string}[] = [
      { id: 'build', label: 'Construção' },
      { id: 'defense', label: 'Defesas' },
      { id: 'simulate', label: 'Simulação' },
  ];

  return (
    <div id="tutorial-control-panel" className="h-full flex flex-col">
        <h2 className="text-2xl font-bold font-orbitron mb-4 text-white border-b border-slate-700 pb-2 flex-shrink-0">
          Painel de Controle
        </h2>
        
        <div className="flex-shrink-0 mb-4 border-b border-slate-700">
            <div className="grid grid-cols-3 gap-2 pb-4">
                {tabs.map(tab => (
                    <button
                        id={`tutorial-tab-${tab.id}`}
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        disabled={isControlsDisabled && !simulationResult}
                        className={`py-2 px-1 text-center font-bold rounded-md transition-colors duration-200 text-sm
                            ${activeTab === tab.id ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 hover:bg-slate-700'}
                            ${isControlsDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex-grow overflow-y-auto pr-2">
            {activeTab === 'build' && (
                <>
                <div className="mb-4">
                    <h3 className="text-lg font-semibold text-amber-300 mb-2">Selecionar Andar</h3>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
                        {['T', ...Array.from({length: NUMBER_OF_FLOORS - 1}, (_, i) => `${i + 1}º`), 'C'].map((level, index) => {
                            const levelId = index === 0 ? 0 : index < NUMBER_OF_FLOORS ? index : 'roof';
                            const isSelected = selectedLevel === levelId;
                            return (
                                <button 
                                    key={level}
                                    onClick={() => {
                                      if (selectedLevel !== levelId) {
                                        playClick();
                                        onSelectLevel(levelId);
                                      }
                                    }}
                                    disabled={isControlsDisabled}
                                    className={`py-2 px-1 text-center font-bold rounded-md transition-colors duration-200 text-sm
                                        ${isSelected ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 hover:bg-slate-700'}
                                        ${isControlsDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                                    `}
                                >
                                    {level}
                                </button>
                            )
                        })}
                    </div>
                </div>
                
                <div className="border-t border-slate-700 pt-4">
                {componentsToShow.map((componentId) => {
                  return (
                    <MaterialSelector
                      key={`${componentId}-${selectedLevel}`}
                      componentId={componentId}
                      currentMaterial={buildingState[componentId][levelIndex]}
                      onChange={(materialId) => onMaterialChange(componentId, materialId, levelIndex)}
                      disabled={isControlsDisabled}
                    />
                  );
                })}
                </div>
              </>
            )}
            
            {activeTab === 'defense' && (
                <>
                {defenseComponents.map((componentId) => {
                  const isComponentDisabled = isControlsDisabled || (!!activeDefenseSystem && activeDefenseSystem !== componentId);
                  return (
                    <MaterialSelector
                      key={componentId}
                      componentId={componentId}
                      currentMaterial={buildingState[componentId][0]}
                      onChange={(materialId) => onMaterialChange(componentId, materialId, 0)}
                      disabled={isComponentDisabled}
                    />
                  );
                })}
              </>
            )}

            {activeTab === 'simulate' && (
              <div className="mt-2">
                {!simulationResult ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(Object.keys(DISASTER_CONFIG) as DisasterId[]).map((disasterId) => {
                        const disaster = DISASTER_CONFIG[disasterId];
                        return (
                          <button
                            key={disasterId}
                            onClick={() => onSimulateDisaster(disasterId)}
                            disabled={isSimulating}
                            className={`flex items-center justify-center gap-2 p-3 text-lg font-semibold text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 disabled:bg-slate-800 disabled:shadow-none disabled:transform-none disabled:cursor-wait ${disasterButtonColors[disasterId]}`}
                          >
                            <disaster.Icon className="text-2xl" />
                            {disaster.label}
                          </button>
                        );
                      })}
                    </div>
                    {isSimulating && (
                      <div className="text-center mt-4 text-yellow-400 animate-pulse">
                        Simulando desastre...
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center">
                    <h2 className="text-xl font-bold font-orbitron mb-2 text-amber-400">Resultado da Simulação</h2>
                    <p className="text-lg text-slate-200 mb-4">{simulationResult}</p>
                    <button
                      onClick={onReset}
                      className="w-full p-3 text-lg font-semibold text-slate-900 bg-amber-500 rounded-lg hover:bg-amber-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1"
                    >
                      Construir Novamente
                    </button>
                  </div>
                )}
              </div>
            )}
      </div>
    </div>
  );
};

export default ControlPanel;
