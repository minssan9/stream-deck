/** Payload sent to the desktop host over the button notification characteristic. */
export interface ButtonEvent {
  button_id: string;
  action: "press" | "release";
}
