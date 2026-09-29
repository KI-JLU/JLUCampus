import {
  COMPONENT_WIDGETS,
  widgetDefinition,
  type Component,
  type Widget
} from '@justcampus/shared'

/** A widget with the component it belongs to, which gives it its name, icon and target. */
export type ComponentWidget = Widget & { component: Component }

/** The API's widgets, each with its component; widgets of unknown components are left out. */
export function joinWidgets(widgets: Widget[], components: Component[]): ComponentWidget[] {
  const byId = new Map(components.map((component) => [component.id, component]))
  return widgets.flatMap((widget): ComponentWidget[] => {
    const component = byId.get(widget.componentId)
    return component ? [{ ...widget, component }] : []
  })
}

/**
 * Every widget a component's type offers, in `COMPONENT_WIDGETS` order. For
 * admin lists, which also show disabled components the API does not list
 * widgets for.
 */
export function widgetsOfComponent(component: Component): ComponentWidget[] {
  return Object.keys(COMPONENT_WIDGETS[component.type]).flatMap((widgetKey) => {
    const definition = widgetDefinition(component.type, widgetKey)
    return definition ? [{ componentId: component.id, widgetKey, ...definition, component }] : []
  })
}
